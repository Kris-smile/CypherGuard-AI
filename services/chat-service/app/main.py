"""Chat Service - RAG-based conversational AI with citations"""

from fastapi import FastAPI, Depends, HTTPException, status, Header, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient
from typing import List, Optional, AsyncGenerator
from uuid import UUID
import httpx
import time
import sys
import os
import json
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User, Mode, Conversation, Message, Chunk
from common.schemas import (
    ConversationCreate, ConversationResponse,
    MessageCreate, MessageResponse,
    ModeCreate, ModeUpdate, ModeResponse,
    ChatResponse, Citation
)
from common.auth import decode_token_payload, TokenPayload
from common.exceptions import NotFoundError, AuthenticationError, AuthorizationError, ConflictError
from sqlalchemy import text as sql_text

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Chat Service",
    version="2.0.0",
    docs_url="/chat/docs",
    openapi_url="/chat/openapi.json",
    redoc_url="/chat/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = Settings()
db = Database(settings.postgres_url)

qdrant_client = QdrantClient(url=settings.qdrant_url)
COLLECTION_NAME = "kb_chunks_v1"

MODEL_GATEWAY_URL = os.getenv("MODEL_GATEWAY_URL", "http://model-gateway:8000")


def get_db():
    return next(db.get_session())


async def get_current_user(authorization: Optional[str] = Header(None)) -> TokenPayload:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("缺少认证令牌")
    token = authorization[7:]
    payload = decode_token_payload(token, settings.jwt_secret, settings.jwt_algorithm)
    if payload is None:
        raise AuthenticationError("令牌无效或已过期")
    return payload


async def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    if user.role != "admin":
        raise AuthorizationError("需要管理员权限")
    return user


# ============== RAG Helper Functions ==============

def get_embeddings(texts: List[str]) -> List[List[float]]:
    with httpx.Client(timeout=60.0) as client:
        response = client.post(f"{MODEL_GATEWAY_URL}/internal/embeddings", json={"texts": texts})
        response.raise_for_status()
        return response.json()["embeddings"]


def search_qdrant(query_vector: List[float], top_k: int = 20) -> List[dict]:
    try:
        results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k,
            with_payload=True
        )
        return [{"id": str(r.id), "score": r.score, "payload": r.payload} for r in results]
    except Exception as e:
        logger.error(f"Qdrant search error: {e}")
        return []


def search_bm25(query: str, top_k: int = 20, session: Session = None) -> List[dict]:
    """Full-text BM25 search using PostgreSQL tsvector/tsquery."""
    if not session:
        session = next(db.get_session())
    try:
        sql = sql_text("""
            SELECT c.id, c.document_id, c.chunk_index, c.text, c.text_hash,
                   c.page_start, c.page_end,
                   d.title, d.source_type, d.source_uri,
                   ts_rank(c.tsv, plainto_tsquery('english', :query)) AS rank
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.tsv @@ plainto_tsquery('english', :query)
              AND c.is_enabled = true
              AND d.status = 'ready'
            ORDER BY rank DESC
            LIMIT :top_k
        """)
        rows = session.execute(sql, {"query": query, "top_k": top_k}).fetchall()
        results = []
        for row in rows:
            results.append({
                "id": str(row.id),
                "score": float(row.rank),
                "payload": {
                    "chunk_id": str(row.id),
                    "document_id": str(row.document_id),
                    "title": row.title,
                    "source_type": row.source_type,
                    "source_uri": row.source_uri,
                    "chunk_index": row.chunk_index,
                    "text": row.text or "",
                    "text_hash": row.text_hash or "",
                    "page_start": row.page_start,
                    "page_end": row.page_end,
                }
            })
        return results
    except Exception as e:
        logger.error(f"BM25 search error: {e}")
        return []


def rrf_merge(vector_results: List[dict], bm25_results: List[dict],
              bm25_weight: float = 0.3, k: int = 60) -> List[dict]:
    """Reciprocal Rank Fusion to merge vector and BM25 results."""
    vector_weight = 1.0 - bm25_weight
    scores = {}
    id_to_item = {}

    for rank, item in enumerate(vector_results):
        item_id = item["id"]
        scores[item_id] = scores.get(item_id, 0) + vector_weight / (k + rank + 1)
        id_to_item[item_id] = item

    for rank, item in enumerate(bm25_results):
        item_id = item["id"]
        scores[item_id] = scores.get(item_id, 0) + bm25_weight / (k + rank + 1)
        if item_id not in id_to_item:
            id_to_item[item_id] = item

    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    merged = []
    for item_id in sorted_ids:
        item = id_to_item[item_id].copy()
        item["rrf_score"] = scores[item_id]
        merged.append(item)
    return merged


def rerank_documents(query: str, documents: List[str], top_n: int = 6) -> Optional[List[dict]]:
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{MODEL_GATEWAY_URL}/internal/rerank",
                json={"query": query, "documents": documents, "top_n": top_n}
            )
            response.raise_for_status()
            return response.json()["results"]
    except Exception as e:
        logger.warning(f"Rerank failed, falling back to vector scores: {e}")
        return None


def generate_chat_response(messages: List[dict], context: str,
                           images: Optional[List[str]] = None,
                           model_config_id: Optional[str] = None) -> str:
    if images and messages:
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                parts = [{"type": "text", "text": content}]
                for img_b64 in images:
                    prefix = img_b64 if img_b64.startswith("data:") else f"data:image/png;base64,{img_b64}"
                    parts.append({"type": "image_url", "image_url": {"url": prefix}})
                msg["content"] = parts
                break
    payload = {"messages": messages}
    if model_config_id:
        payload["model_config_id"] = model_config_id
    with httpx.Client(timeout=120.0) as client:
        response = client.post(f"{MODEL_GATEWAY_URL}/internal/chat", json=payload)
        response.raise_for_status()
        return response.json()["content"]


def build_context_prompt(mode: Mode, chunks: List[dict], query: str,
                         history_messages: Optional[List[dict]] = None) -> List[dict]:
    context_parts = []
    for i, chunk in enumerate(chunks):
        payload = chunk.get("payload", chunk)
        text = payload.get("text", "")
        title = payload.get("title", "Unknown")
        context_parts.append(f"[来源 {i+1}: {title}]\n{text}\n")
    context_text = "\n".join(context_parts)

    msgs = [
        {"role": "system", "content": f"{mode.system_prompt}\n\n知识库上下文:\n{context_text}"}
    ]
    if history_messages:
        msgs.extend(history_messages)
    msgs.append({"role": "user", "content": query})
    return msgs


def load_conversation_history(conversation_id, session, window_size: int = 10) -> List[dict]:
    """Load recent conversation history as sliding window."""
    recent = session.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.role.in_(["user", "assistant"])
    ).order_by(Message.created_at.desc()).limit(window_size).all()
    recent.reverse()
    return [{"role": m.role, "content": m.content} for m in recent]


def web_search(query: str, max_results: int = 5) -> List[dict]:
    """Search the web using DuckDuckGo and return results as chunk-like structures."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        chunks = []
        for i, r in enumerate(results):
            title = r.get("title", "Web Result")
            body = r.get("body", "")
            href = r.get("href", "")
            chunks.append({
                "id": f"web_{i}",
                "score": 1.0 - i * 0.1,
                "payload": {
                    "chunk_id": f"web_{i}",
                    "document_id": f"web_search",
                    "title": title,
                    "source_type": "web_search",
                    "source_uri": href,
                    "chunk_index": i,
                    "text": f"{title}\n{body}",
                    "text_hash": "",
                }
            })
        return chunks
    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        return []


def rewrite_query(query: str, history: List[dict]) -> str:
    """Use LLM to rewrite query incorporating conversation context."""
    if not history:
        return query
    history_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
    rewrite_messages = [
        {"role": "system", "content": (
            "根据对话历史和最新问题，将问题改写为独立的检索查询。"
            "只输出改写后的查询，不要其他内容。如果问题已经足够独立，原样返回。"
        )},
        {"role": "user", "content": f"对话历史:\n{history_text}\n\n最新问题: {query}"}
    ]
    try:
        rewritten = generate_chat_response(rewrite_messages, "")
        return rewritten.strip() if rewritten.strip() else query
    except Exception as e:
        logger.warning(f"Query rewrite failed: {e}")
        return query


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    return "OK"


@app.get("/chat/healthz", response_class=PlainTextResponse)
async def chat_health_check():
    return "Chat Service OK"


# ============== Modes CRUD (admin only for create/update) ==============

@app.get("/chat/modes", response_model=List[ModeResponse])
async def list_modes(session: Session = Depends(get_db)):
    modes = session.query(Mode).all()
    return [ModeResponse.model_validate(m) for m in modes]


@app.post("/chat/modes", response_model=ModeResponse, status_code=status.HTTP_201_CREATED)
async def create_mode(
    data: ModeCreate,
    admin: TokenPayload = Depends(require_admin),
    session: Session = Depends(get_db)
):
    """Create a new chat mode (admin only)."""
    existing = session.query(Mode).filter(Mode.name == data.name).first()
    if existing:
        raise ConflictError(f"模式 '{data.name}' 已存在")
    mode = Mode(**data.model_dump())
    session.add(mode)
    session.commit()
    session.refresh(mode)
    return ModeResponse.model_validate(mode)


@app.put("/chat/modes/{mode_id}", response_model=ModeResponse)
async def update_mode(
    mode_id: UUID,
    data: ModeUpdate,
    admin: TokenPayload = Depends(require_admin),
    session: Session = Depends(get_db)
):
    """Update an existing chat mode (admin only)."""
    mode = session.query(Mode).filter(Mode.id == mode_id).first()
    if not mode:
        raise NotFoundError("模式未找到")
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing = session.query(Mode).filter(Mode.name == update_data["name"], Mode.id != mode_id).first()
        if existing:
            raise ConflictError(f"模式名 '{update_data['name']}' 已被使用")
    for key, value in update_data.items():
        setattr(mode, key, value)
    session.commit()
    session.refresh(mode)
    return ModeResponse.model_validate(mode)


# ============== Conversations ==============

@app.post("/chat/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: ConversationCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    mode = session.query(Mode).filter(Mode.name == request.mode_name).first()
    if not mode:
        mode = session.query(Mode).filter(Mode.name == "quick").first()
        if not mode:
            raise HTTPException(status_code=404, detail="没有可用的对话模式")
    conversation = Conversation(user_id=user.sub, mode_id=mode.id, title=request.title)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@app.get("/chat/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    conversations = session.query(Conversation).filter(
        Conversation.user_id == user.sub
    ).order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()
    return [ConversationResponse.model_validate(c) for c in conversations]


@app.delete("/chat/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("对话未找到")
    session.query(Message).filter(Message.conversation_id == conversation_id).delete()
    session.delete(conversation)
    session.commit()
    return None


@app.get("/chat/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("对话未找到")
    messages = session.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    return [MessageResponse.model_validate(m) for m in messages]


@app.post("/chat/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(
    conversation_id: UUID,
    request: MessageCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Send a message and get RAG-based response with citations (hybrid retrieval + context)."""
    trace = {"top_k": 0, "top_n": 0, "retrieval_strategy": "vector", "latency_ms": {}}
    start_total = time.time()

    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("对话未找到")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="对话模式配置异常")

    strategy = getattr(mode, "retrieval_strategy", "vector") or "vector"
    bm25_weight = getattr(mode, "bm25_weight", 0.3) or 0.3
    trace["top_k"] = mode.top_k
    trace["top_n"] = mode.top_n
    trace["retrieval_strategy"] = strategy

    user_message = Message(
        conversation_id=conversation_id, role="user", content=request.content,
        images_json=request.images if request.images else None
    )
    session.add(user_message)
    session.commit()

    chat_model_config_id = request.model_config_id

    # Step 0: Load conversation history + query rewrite
    ctx_config = conversation.context_config or {"strategy": "sliding_window", "window_size": 10}
    window_size = ctx_config.get("window_size", 10)
    history = load_conversation_history(conversation_id, session, window_size)

    start_rewrite = time.time()
    search_query = rewrite_query(request.content, history) if history else request.content
    trace["latency_ms"]["rewrite"] = int((time.time() - start_rewrite) * 1000)
    trace["rewritten_query"] = search_query

    # Step 1: Embedding (needed for vector/hybrid)
    vector_results = []
    if strategy in ("vector", "hybrid"):
        start_embed = time.time()
        query_embeddings = get_embeddings([search_query])
        query_vector = query_embeddings[0]
        trace["latency_ms"]["embed"] = int((time.time() - start_embed) * 1000)

        start_search = time.time()
        vector_results = search_qdrant(query_vector, top_k=mode.top_k)
        trace["latency_ms"]["vector_search"] = int((time.time() - start_search) * 1000)

    # Step 2: BM25 search (needed for bm25/hybrid)
    bm25_results = []
    if strategy in ("bm25", "hybrid"):
        start_bm25 = time.time()
        bm25_results = search_bm25(search_query, top_k=mode.top_k, session=session)
        trace["latency_ms"]["bm25_search"] = int((time.time() - start_bm25) * 1000)

    # Step 3: Merge results
    if strategy == "hybrid" and vector_results and bm25_results:
        search_results = rrf_merge(vector_results, bm25_results, bm25_weight=bm25_weight)
    elif strategy == "bm25":
        search_results = bm25_results
    else:
        search_results = vector_results

    # Step 3b: Web search supplement (if enabled and results insufficient)
    enable_web = getattr(mode, "enable_web_search", False) or False
    web_results = []
    if enable_web and len(search_results) < mode.top_n:
        start_web = time.time()
        web_results = web_search(search_query, max_results=5)
        search_results.extend(web_results)
        trace["latency_ms"]["web_search"] = int((time.time() - start_web) * 1000)

    trace["vector_count"] = len(vector_results)
    trace["bm25_count"] = len(bm25_results)
    trace["web_count"] = len(web_results)
    trace["merged_count"] = len(search_results)

    # Step 4: Rerank
    start_rerank = time.time()
    if search_results:
        documents = [r["payload"]["text"] for r in search_results[:mode.top_k]]
        rerank_results = rerank_documents(search_query, documents, top_n=mode.top_n)
        if rerank_results:
            reranked_chunks = []
            for rr in rerank_results:
                idx = rr["index"]
                if idx < len(search_results):
                    chunk = search_results[idx].copy()
                    chunk["rerank_score"] = rr["score"]
                    reranked_chunks.append(chunk)
            final_chunks = reranked_chunks
        else:
            final_chunks = search_results[:mode.top_n]
    else:
        final_chunks = []
    trace["latency_ms"]["rerank"] = int((time.time() - start_rerank) * 1000)

    # Step 5: Build citations
    citations = []
    if final_chunks and mode.min_score > 0:
        final_chunks = [c for c in final_chunks if c.get("score", 0) >= mode.min_score or c.get("rrf_score", 0) > 0]

    for chunk in final_chunks:
        payload = chunk.get("payload", {})
        citations.append(Citation(
            document_id=payload.get("document_id", ""),
            title=payload.get("title", "Unknown"),
            source_type=payload.get("source_type", "upload"),
            source_uri=payload.get("source_uri", ""),
            chunk_id=payload.get("chunk_id", chunk.get("id", "")),
            chunk_index=payload.get("chunk_index", 0),
            page_start=payload.get("page_start"),
            page_end=payload.get("page_end"),
            snippet=payload.get("text", "")[:200],
            score=chunk.get("rerank_score", chunk.get("rrf_score", chunk.get("score", 0)))
        ))

    # Step 6: Generate response
    start_llm = time.time()
    if not final_chunks and mode.require_citations:
        if mode.no_evidence_behavior == "refuse":
            answer = "抱歉，无法从知识库中找到与您问题相关的信息。请尝试换个说法提问，或确认相关文档已上传到知识库。"
        else:
            answer = "⚠️ 警告：知识库中未找到相关证据。以下回答可能不准确，请谨慎参考。"
    else:
        messages = build_context_prompt(mode, final_chunks, request.content, history if history else None)
        answer = generate_chat_response(messages, "", images=request.images,
                                        model_config_id=chat_model_config_id)

    trace["latency_ms"]["llm"] = int((time.time() - start_llm) * 1000)
    trace["latency_ms"]["total"] = int((time.time() - start_total) * 1000)

    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=answer,
        citations_json=[c.model_dump() for c in citations] if citations else None
    )
    session.add(assistant_message)
    session.commit()

    if not conversation.title:
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
        session.commit()

    return ChatResponse(answer=answer, citations=citations, mode=mode.name, trace=trace)


# ============== Agent Mode (ReACT) ==============

AGENT_SYSTEM_PROMPT = """你是 CypherGuard AI 智能助手，具有以下工具：

1. knowledge_search(query) - 在知识库中搜索相关信息
2. web_search(query) - 在互联网上搜索实时信息
3. get_document_info(document_id) - 获取文档详细信息

请按以下格式推理：
Thought: 分析问题，决定下一步操作
Action: tool_name(参数)
Observation: [工具返回结果]
... (可重复多轮)
Final Answer: 最终回答

重要：每次只能使用一个工具。如果不需要工具，直接给出 Final Answer。"""


def run_agent(query: str, mode: Mode, session: Session, max_rounds: int = 5) -> tuple:
    """Run ReACT agent loop. Returns (answer, citations, agent_steps)."""
    agent_steps = []
    all_citations = []
    context_texts = []

    messages = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT + "\n\n" + (mode.system_prompt or "")},
        {"role": "user", "content": query}
    ]

    for round_num in range(max_rounds):
        response_text = generate_chat_response(messages, "")
        agent_steps.append({"round": round_num + 1, "llm_output": response_text})

        if "Final Answer:" in response_text:
            answer = response_text.split("Final Answer:")[-1].strip()
            return answer, all_citations, agent_steps

        import re
        action_match = re.search(r"Action:\s*(\w+)\((.+?)\)", response_text)
        if not action_match:
            return response_text, all_citations, agent_steps

        tool_name = action_match.group(1)
        tool_arg = action_match.group(2).strip().strip("'\"")
        observation = ""

        if tool_name == "knowledge_search":
            try:
                embeddings = get_embeddings([tool_arg])
                results = search_qdrant(embeddings[0], top_k=mode.top_k)
                if results:
                    obs_parts = []
                    for r in results[:mode.top_n]:
                        p = r["payload"]
                        obs_parts.append(f"[{p.get('title', 'N/A')}]: {p.get('text', '')[:300]}")
                        all_citations.append(Citation(
                            document_id=p.get("document_id", ""),
                            title=p.get("title", ""),
                            source_type=p.get("source_type", ""),
                            source_uri=p.get("source_uri", ""),
                            chunk_id=p.get("chunk_id", ""),
                            chunk_index=p.get("chunk_index", 0),
                            snippet=p.get("text", "")[:200],
                            score=r.get("score", 0)
                        ))
                    observation = "\n".join(obs_parts)
                else:
                    observation = "知识库中未找到相关结果。"
            except Exception as e:
                observation = f"知识库搜索出错: {str(e)}"

        elif tool_name == "web_search":
            web_results = web_search(tool_arg, max_results=3)
            if web_results:
                obs_parts = [f"[{r['payload']['title']}]: {r['payload']['text'][:200]}" for r in web_results]
                observation = "\n".join(obs_parts)
            else:
                observation = "网络搜索无结果。"

        elif tool_name == "get_document_info":
            try:
                from common.models import Document
                doc = session.query(Document).filter(Document.id == tool_arg).first()
                if doc:
                    observation = f"标题: {doc.title}, 类型: {doc.source_type}, 状态: {doc.status}, 标签: {doc.tags}"
                else:
                    observation = "文档未找到。"
            except Exception as e:
                observation = f"查询出错: {str(e)}"
        else:
            observation = f"未知工具: {tool_name}"

        agent_steps[-1]["action"] = f"{tool_name}({tool_arg})"
        agent_steps[-1]["observation"] = observation

        messages.append({"role": "assistant", "content": response_text})
        messages.append({"role": "user", "content": f"Observation: {observation}\n\n请继续推理。"})

    return "达到最大推理轮次，请简化问题。", all_citations, agent_steps


@app.post("/chat/conversations/{conversation_id}/messages/agent", response_model=ChatResponse)
async def send_message_agent(
    conversation_id: UUID,
    request: MessageCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Send a message using Agent mode (ReACT reasoning)."""
    start_total = time.time()
    trace = {"mode": "agent", "latency_ms": {}}

    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("对话未找到")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="对话模式配置异常")

    user_message = Message(
        conversation_id=conversation_id, role="user", content=request.content,
        images_json=request.images if request.images else None
    )
    session.add(user_message)
    session.commit()

    answer, citations, agent_steps = run_agent(request.content, mode, session)

    trace["latency_ms"]["total"] = int((time.time() - start_total) * 1000)
    trace["agent_rounds"] = len(agent_steps)

    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=answer,
        citations_json=[c.model_dump() for c in citations] if citations else None,
        agent_steps=agent_steps
    )
    session.add(assistant_message)
    session.commit()

    if not conversation.title:
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
        session.commit()

    return ChatResponse(answer=answer, citations=citations, mode=f"{mode.name}+agent", trace=trace)


@app.post("/chat/conversations/{conversation_id}/messages/stream")
async def send_message_stream(
    conversation_id: UUID,
    request: MessageCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Send a message and get streaming RAG response via SSE."""
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("对话未找到")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="对话模式配置异常")

    user_message = Message(
        conversation_id=conversation_id, role="user", content=request.content,
        images_json=request.images if request.images else None
    )
    session.add(user_message)
    session.commit()

    chat_model_config_id = request.model_config_id
    strategy = getattr(mode, "retrieval_strategy", "vector") or "vector"
    bm25_weight = getattr(mode, "bm25_weight", 0.3) or 0.3

    ctx_config = conversation.context_config or {"strategy": "sliding_window", "window_size": 10}
    window_size = ctx_config.get("window_size", 10)
    history = load_conversation_history(conversation_id, session, window_size)
    search_query = rewrite_query(request.content, history) if history else request.content

    async def event_stream() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'type': 'status', 'message': '正在检索知识库...'}, ensure_ascii=False)}\n\n"

        vector_results = []
        if strategy in ("vector", "hybrid"):
            query_embeddings = get_embeddings([search_query])
            query_vector = query_embeddings[0]
            vector_results = search_qdrant(query_vector, top_k=mode.top_k)

        bm25_results_local = []
        if strategy in ("bm25", "hybrid"):
            bm25_results_local = search_bm25(search_query, top_k=mode.top_k, session=session)

        if strategy == "hybrid" and vector_results and bm25_results_local:
            search_results = rrf_merge(vector_results, bm25_results_local, bm25_weight=bm25_weight)
        elif strategy == "bm25":
            search_results = bm25_results_local
        else:
            search_results = vector_results

        yield f"data: {json.dumps({'type': 'status', 'message': '正在重排序...'}, ensure_ascii=False)}\n\n"

        if search_results:
            documents = [r["payload"]["text"] for r in search_results[:mode.top_k]]
            rerank_results = rerank_documents(search_query, documents, top_n=mode.top_n)
            if rerank_results:
                final_chunks = []
                for rr in rerank_results:
                    idx = rr["index"]
                    if idx < len(search_results):
                        chunk = search_results[idx].copy()
                        chunk["rerank_score"] = rr["score"]
                        final_chunks.append(chunk)
            else:
                final_chunks = search_results[:mode.top_n]
        else:
            final_chunks = []

        if final_chunks and mode.min_score > 0:
            final_chunks = [c for c in final_chunks if c.get("score", 0) >= mode.min_score or c.get("rrf_score", 0) > 0]

        citations = []
        for chunk in final_chunks:
            payload = chunk.get("payload", {})
            citations.append(Citation(
                document_id=payload.get("document_id", ""),
                title=payload.get("title", "Unknown"),
                source_type=payload.get("source_type", "upload"),
                source_uri=payload.get("source_uri", ""),
                chunk_id=payload.get("chunk_id", chunk.get("id", "")),
                chunk_index=payload.get("chunk_index", 0),
                page_start=payload.get("page_start"),
                page_end=payload.get("page_end"),
                snippet=payload.get("text", "")[:200],
                score=chunk.get("rerank_score", chunk.get("rrf_score", chunk.get("score", 0)))
            ))

        if not final_chunks and mode.require_citations:
            if mode.no_evidence_behavior == "refuse":
                answer_text = "抱歉，无法从知识库中找到与您问题相关的信息。请尝试换个说法提问，或确认相关文档已上传到知识库。"
            else:
                answer_text = "⚠️ 警告：知识库中未找到相关证据。以下回答可能不准确，请谨慎参考。"
            yield f"data: {json.dumps({'type': 'token', 'content': answer_text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'citations': [c.model_dump() for c in citations]}, ensure_ascii=False)}\n\n"
            assistant_msg = Message(
                conversation_id=conversation_id, role="assistant", content=answer_text,
                citations_json=[c.model_dump() for c in citations] if citations else None
            )
            session.add(assistant_msg)
            session.commit()
            return

        yield f"data: {json.dumps({'type': 'status', 'message': '正在生成回答...'}, ensure_ascii=False)}\n\n"

        llm_messages = build_context_prompt(mode, final_chunks, request.content, history if history else None)
        if request.images and llm_messages:
            for msg in reversed(llm_messages):
                if msg.get("role") == "user":
                    content = msg.get("content", "")
                    parts = [{"type": "text", "text": content}]
                    for img_b64 in request.images:
                        prefix = img_b64 if img_b64.startswith("data:") else f"data:image/png;base64,{img_b64}"
                        parts.append({"type": "image_url", "image_url": {"url": prefix}})
                    msg["content"] = parts
                    break
        full_answer = ""

        stream_payload = {"messages": llm_messages, "temperature": 0.7, "max_tokens": 2048}
        if chat_model_config_id:
            stream_payload["model_config_id"] = chat_model_config_id
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST", f"{MODEL_GATEWAY_URL}/internal/chat/stream",
                    json=stream_payload
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if data.get("type") == "token":
                                full_answer += data.get("content", "")
                                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Streaming LLM error: {e}")
            full_answer = f"生成回答时出错: {str(e)}"
            yield f"data: {json.dumps({'type': 'token', 'content': full_answer}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'citations': [c.model_dump() for c in citations]}, ensure_ascii=False)}\n\n"

        assistant_msg = Message(
            conversation_id=conversation_id, role="assistant", content=full_answer,
            citations_json=[c.model_dump() for c in citations] if citations else None
        )
        session.add(assistant_msg)
        session.commit()

        if not conversation.title:
            conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
            session.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
