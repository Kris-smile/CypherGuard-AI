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
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User, Mode, Conversation, Message, Chunk, Document
from common.schemas import (
    ConversationCreate, ConversationUpdate, ConversationResponse,
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
COLLECTION_NAME = "kb_chunks_v2"

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


def get_document_ids_for_kbs(knowledge_base_ids: List[str], session: Session) -> List[str]:
    """Get all document IDs belonging to the given knowledge bases."""
    docs = session.query(Document.id).filter(
        Document.knowledge_base_id.in_(knowledge_base_ids),
        Document.status == 'ready'
    ).all()
    return [str(d.id) for d in docs]


def search_qdrant(query_vector: List[float], top_k: int = 20,
                  document_ids: Optional[List[str]] = None,
                  knowledge_base_ids: Optional[List[str]] = None) -> List[dict]:
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchAny
        conditions = []
        if document_ids:
            conditions.append(FieldCondition(key="document_id", match=MatchAny(any=document_ids)))
        if knowledge_base_ids:
            conditions.append(FieldCondition(key="knowledge_base_id", match=MatchAny(any=knowledge_base_ids)))
        query_filter = Filter(must=conditions) if conditions else None
        results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k,
            with_payload=True,
            query_filter=query_filter
        )
        return [{"id": str(r.id), "score": r.score, "payload": r.payload} for r in results]
    except Exception as e:
        logger.error(f"Qdrant search error: {e}")
        return []


def search_bm25(
    query: str,
    top_k: int = 20,
    session: Session = None,
    knowledge_base_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
) -> List[dict]:
    """Full-text BM25 search using PostgreSQL tsvector/tsquery."""
    if not session:
        session = next(db.get_session())
    try:
        kb_filter = ""
        doc_filter = ""
        params: dict = {"query": query, "top_k": top_k}
        if knowledge_base_ids:
            kb_filter = "AND d.knowledge_base_id = ANY(:kb_ids)"
            params["kb_ids"] = knowledge_base_ids
        if document_ids:
            doc_filter = "AND d.id::text = ANY(:document_ids)"
            params["document_ids"] = document_ids
        sql = sql_text(f"""
            SELECT c.id, c.document_id, c.chunk_index, c.text, c.text_hash,
                   c.page_start, c.page_end,
                   d.title, d.source_type, d.source_uri,
                   ts_rank(c.tsv, plainto_tsquery('english', :query)) AS rank
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.tsv @@ plainto_tsquery('english', :query)
              AND c.is_enabled = true
              AND d.status = 'ready'
              {kb_filter}
              {doc_filter}
            ORDER BY rank DESC
            LIMIT :top_k
        """)
        rows = session.execute(sql, params).fetchall()
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
        if session is not None:
            session.rollback()
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


RERANK_SCORE_THRESHOLD = 0.05


def validate_traceable_evidence(chunks: List[dict], session: Session) -> List[dict]:
    """Filter chunks to only those with a traceable DB source record.

    Web search and FAQ results are always accepted.  For document chunks,
    verify the chunk exists and is enabled in PostgreSQL.
    """
    validated = []
    for chunk in chunks:
        payload = chunk.get("payload", {})
        source_type = payload.get("source_type", "")
        document_id = payload.get("document_id", "")

        if source_type == "web_search":
            validated.append(chunk)
            continue

        if document_id.startswith("faq_") or source_type == "faq":
            validated.append(chunk)
            continue

        db_chunk_id = payload.get("db_chunk_id")
        if db_chunk_id:
            db_chunk = session.query(Chunk).filter(
                Chunk.id == db_chunk_id, Chunk.is_enabled == True
            ).first()
            if db_chunk:
                validated.append(chunk)
                continue

        chunk_index = payload.get("chunk_index", -1)
        if document_id:
            db_chunk = session.query(Chunk).filter(
                Chunk.document_id == document_id,
                Chunk.chunk_index == chunk_index,
                Chunk.is_enabled == True,
            ).first()
            if db_chunk:
                payload["db_chunk_id"] = str(db_chunk.id)
                validated.append(chunk)
                continue

        logger.warning(f"Dropping untraceable chunk: doc={document_id} idx={chunk_index}")
    return validated


def build_citations_from_chunks(chunks: List[dict]) -> List['Citation']:
    """Build Citation list from ranked chunks, preferring db_chunk_id for traceability."""
    citations = []
    for index, chunk in enumerate(chunks):
        payload = chunk.get("payload", {})
        chunk_id = payload.get("db_chunk_id") or payload.get("chunk_id", chunk.get("id", ""))
        citations.append(Citation(
            reference_id=index + 1,
            document_id=payload.get("document_id", ""),
            title=payload.get("title", "Unknown"),
            source_type=payload.get("source_type", "upload"),
            source_uri=payload.get("source_uri", ""),
            chunk_id=chunk_id,
            chunk_index=payload.get("chunk_index", 0),
            page_start=payload.get("page_start"),
            page_end=payload.get("page_end"),
            snippet=payload.get("text", "")[:200],
            score=chunk.get("rerank_score", chunk.get("rrf_score", chunk.get("score", 0)))
        ))
    return citations


def build_reference_index(citations: List['Citation']) -> dict:
    reference_index = {}
    next_index = 1

    for citation in citations:
        key = (
            citation.source_uri or "",
            citation.document_id or "",
            citation.title or "",
            citation.source_type or "",
        )
        if key not in reference_index:
            reference_index[key] = next_index
            next_index += 1

    return reference_index


def append_reference_markers(answer: str, citations: List['Citation']) -> str:
    if not answer or not citations or re.search(r"\[\d+\]", answer):
        return answer

    reference_index = build_reference_index(citations)
    markers = []
    seen = set()

    for citation in citations:
        key = (
            citation.source_uri or "",
            citation.document_id or "",
            citation.title or "",
            citation.source_type or "",
        )
        marker_number = reference_index.get(key)
        if marker_number and marker_number not in seen:
            seen.add(marker_number)
            markers.append(f"[{marker_number}]")
        if len(markers) >= 3:
            break

    if not markers:
        return answer

    return f"{answer.rstrip()}\n\n参考来源：{' '.join(markers)}"


def parse_agent_tool_arg(raw_arg: str) -> str:
    """Normalize agent tool arguments like `query="..."` into a plain value."""
    arg = (raw_arg or "").strip()
    if "=" in arg:
        _, arg = arg.split("=", 1)
    return arg.strip().strip("'\"")


def build_no_evidence_answer(mode: Mode, web_enabled: bool = False, web_status: str = "disabled") -> str:
    if web_enabled:
        if web_status == "empty":
            return "未找到相关搜索结果。"
        if web_status == "timeout":
            return "联网搜索超时，请稍后重试。"
        if web_status == "error":
            return "联网搜索出现异常，请稍后重试。"

    if mode.no_evidence_behavior == "refuse":
        return "抱歉，当前没有足够证据支持回答这个问题。"

    return "当前没有检索到足够证据，以下回答可能不够准确，请谨慎参考。"


def perform_web_search(query: str, max_results: int = 5) -> dict:
    try:
        from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        if not results:
            return {
                "results": [],
                "status": "empty",
                "message": "未找到相关搜索结果",
            }

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
                    "document_id": "web_search",
                    "title": title,
                    "source_type": "web_search",
                    "source_uri": href,
                    "chunk_index": i,
                    "text": f"{title}\n{body}",
                    "text_hash": "",
                }
            })

        return {
            "results": chunks,
            "status": "success",
            "message": "",
        }
    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        error_text = str(e).lower()
        status = "timeout" if "timeout" in error_text or "timed out" in error_text else "error"
        message = "联网搜索超时" if status == "timeout" else "联网搜索失败"
        return {
            "results": [],
            "status": status,
            "message": message,
        }


def dedupe_chunks(chunks: List[dict]) -> List[dict]:
    deduped = []
    seen = set()

    for chunk in chunks:
        payload = chunk.get("payload", {})
        key = (
            payload.get("document_id", ""),
            payload.get("db_chunk_id") or payload.get("chunk_id", chunk.get("id", "")),
            payload.get("chunk_index", -1),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(chunk)

    return deduped


def build_selected_document_context(document_ids: List[str], session: Session) -> List[dict]:
    """Build guaranteed context chunks for explicitly selected documents."""
    if not document_ids:
        return []

    selected_docs = session.query(Document).filter(
        Document.id.in_(document_ids),
        Document.status == "ready",
    ).all()
    if not selected_docs:
        return []

    ordered_doc_ids = [str(doc_id) for doc_id in document_ids]
    doc_by_id = {str(doc.id): doc for doc in selected_docs}
    chunk_rows = session.query(Chunk).filter(
        Chunk.document_id.in_([doc.id for doc in selected_docs]),
        Chunk.is_enabled == True,
    ).order_by(Chunk.document_id.asc(), Chunk.chunk_index.asc()).all()

    first_chunk_by_doc: dict[str, Chunk] = {}
    for chunk in chunk_rows:
        chunk_doc_id = str(chunk.document_id)
        if chunk_doc_id not in first_chunk_by_doc:
            first_chunk_by_doc[chunk_doc_id] = chunk

    context_chunks = []
    for document_id in ordered_doc_ids:
        doc = doc_by_id.get(document_id)
        if not doc:
            continue

        first_chunk = first_chunk_by_doc.get(document_id)
        summary_text = (doc.summary or "").strip()
        excerpt_text = ((first_chunk.text or "").strip() if first_chunk else "")
        parts = [
            f"Selected document: {doc.title}",
            f"Source type: {doc.source_type}",
        ]
        if doc.tags:
            parts.append(f"Tags: {', '.join(doc.tags)}")
        if summary_text:
            parts.append(f"Summary: {summary_text}")
        if excerpt_text:
            parts.append(f"Excerpt: {excerpt_text[:800]}")
        if not summary_text and not excerpt_text:
            parts.append("No parsed summary is available yet for this document.")

        context_chunks.append({
            "id": f"selected_doc::{document_id}",
            "score": 2.0,
            "payload": {
                "chunk_id": str(first_chunk.id) if first_chunk else f"selected_doc::{document_id}",
                "db_chunk_id": str(first_chunk.id) if first_chunk else None,
                "document_id": document_id,
                "title": doc.title,
                "source_type": doc.source_type,
                "source_uri": doc.source_uri,
                "chunk_index": first_chunk.chunk_index if first_chunk else -1,
                "page_start": first_chunk.page_start if first_chunk else None,
                "page_end": first_chunk.page_end if first_chunk else None,
                "text": "\n".join(parts),
                "text_hash": first_chunk.text_hash if first_chunk else "",
                "selected_document_context": True,
            }
        })

    return context_chunks


def retrieve_evidence(
    query: str,
    mode: Mode,
    session: Session,
    knowledge_base_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
    allow_web_search: bool = True,
    enable_web_search_override: Optional[bool] = None,
) -> dict:
    """Shared retrieval pipeline for normal chat and agent tools."""
    trace = {"retrieval_strategy": getattr(mode, "retrieval_strategy", "vector") or "vector", "latency_ms": {}}
    strategy = trace["retrieval_strategy"]
    bm25_weight = getattr(mode, "bm25_weight", 0.3) or 0.3

    effective_document_ids = document_ids[:] if document_ids else None
    if not effective_document_ids and knowledge_base_ids:
        effective_document_ids = get_document_ids_for_kbs(knowledge_base_ids, session)
    effective_knowledge_base_ids = knowledge_base_ids if not document_ids else None
    selected_document_context = (
        build_selected_document_context(effective_document_ids, session)
        if document_ids
        else []
    )

    vector_results = []
    if strategy in ("vector", "hybrid"):
        start_embed = time.time()
        query_embeddings = get_embeddings([query])
        query_vector = query_embeddings[0]
        trace["latency_ms"]["embed"] = int((time.time() - start_embed) * 1000)

        start_vector = time.time()
        vector_results = search_qdrant(
            query_vector,
            top_k=mode.top_k,
            document_ids=effective_document_ids,
            knowledge_base_ids=effective_knowledge_base_ids,
        )
        trace["latency_ms"]["vector_search"] = int((time.time() - start_vector) * 1000)

    bm25_results = []
    if strategy in ("bm25", "hybrid"):
        start_bm25 = time.time()
        bm25_results = search_bm25(
            query,
            top_k=mode.top_k,
            session=session,
            knowledge_base_ids=effective_knowledge_base_ids,
            document_ids=effective_document_ids,
        )
        trace["latency_ms"]["bm25_search"] = int((time.time() - start_bm25) * 1000)

    if strategy == "hybrid" and vector_results and bm25_results:
        search_results = rrf_merge(vector_results, bm25_results, bm25_weight=bm25_weight)
    elif strategy == "bm25":
        search_results = bm25_results
    else:
        search_results = vector_results

    if selected_document_context:
        search_results = dedupe_chunks(selected_document_context + search_results)

    web_results = []
    enable_web = (
        enable_web_search_override
        if enable_web_search_override is not None
        else (getattr(mode, "enable_web_search", False) or False)
    ) and allow_web_search
    trace["web_search_enabled"] = enable_web
    trace["web_search_status"] = "disabled"
    trace["web_search_message"] = ""
    if enable_web and len(search_results) < mode.top_n:
        start_web = time.time()
        web_search_response = perform_web_search(query, max_results=5)
        web_results = web_search_response["results"]
        search_results.extend(web_results)
        trace["latency_ms"]["web_search"] = int((time.time() - start_web) * 1000)
        trace["web_search_status"] = web_search_response["status"]
        trace["web_search_message"] = web_search_response["message"]
    elif enable_web:
        trace["web_search_status"] = "skipped"

    start_rerank = time.time()
    if search_results:
        documents = [r["payload"]["text"] for r in search_results[:mode.top_k]]
        rerank_results = rerank_documents(query, documents, top_n=mode.top_n)
        if rerank_results:
            reranked_chunks = []
            for rr in rerank_results:
                if rr["score"] < RERANK_SCORE_THRESHOLD:
                    continue
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

    if final_chunks and mode.min_score > 0:
        final_chunks = [
            c for c in final_chunks
            if c.get("score", 0) >= mode.min_score or c.get("rrf_score", 0) > 0
        ]
    if selected_document_context:
        forced_context = selected_document_context[: min(len(selected_document_context), 3)]
        final_chunks = dedupe_chunks(forced_context + final_chunks)
    final_chunks = validate_traceable_evidence(final_chunks, session)
    citations = build_citations_from_chunks(final_chunks)

    trace["vector_count"] = len(vector_results)
    trace["bm25_count"] = len(bm25_results)
    trace["web_count"] = len(web_results)
    trace["merged_count"] = len(search_results)
    trace["traceable_count"] = len(final_chunks)
    trace["selected_document_count"] = len(effective_document_ids or [])
    trace["selected_document_context_count"] = len(selected_document_context)
    trace["selected_kb_count"] = len(knowledge_base_ids or [])

    return {
        "final_chunks": final_chunks,
        "citations": citations,
        "trace": trace,
    }


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
    selected_titles = []
    for i, chunk in enumerate(chunks):
        payload = chunk.get("payload", chunk)
        text = payload.get("text", "")
        title = payload.get("title", "Unknown")
        if payload.get("selected_document_context"):
            selected_titles.append(title)
        context_parts.append(f"[来源{i+1}: {title}]\n{text}\n")
    context_text = "\n".join(context_parts)
    citation_instruction = (
        "请严格基于提供的上下文回答问题。若使用了上下文中的内容，请在对应句子后追加引用标记，如 [1] [2]。"
        "不要编造未出现在上下文中的文档或来源。"
    )
    selected_doc_instruction = ""
    if selected_titles:
        selected_doc_instruction = (
            "The user explicitly selected these documents: "
            + ", ".join(selected_titles[:5])
            + ". Prioritize answering from these selected documents. "
              "If the user asks which file is being referenced, explicitly name the selected document title(s). "
              "Do not answer as if no document was selected.\n\n"
        )

    msgs = [
        {"role": "system", "content": f"{mode.system_prompt}\n\n{selected_doc_instruction}以下是可引用的上下文：\n{context_text}"}
    ]
    msgs[0]["content"] = (
        f"{mode.system_prompt}\n\n{citation_instruction}\n\n"
        + msgs[0]["content"].split("\n\n", 1)[1]
    )
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
    return perform_web_search(query, max_results=max_results)["results"]


def rewrite_query(query: str, history: List[dict]) -> str:
    """Use LLM to rewrite query incorporating conversation context."""
    if not history:
        return query
    history_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
    rewrite_messages = [
        {"role": "system", "content": (
            "你是查询改写助手。请结合历史对话，把用户当前问题改写成更适合知识库检索的一句话。"
            "不要回答问题，只输出改写后的检索问句。"
        )},
        {"role": "user", "content": f"对话历史：\n{history_text}\n\n当前问题：{query}"}
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
        raise ConflictError(f"模式名称已存在: '{data.name}'")
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
        raise NotFoundError("???")
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing = session.query(Mode).filter(Mode.name == update_data["name"], Mode.id != mode_id).first()
        if existing:
            raise ConflictError(f"模式名称已存在: '{update_data['name']}'")
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
            raise HTTPException(status_code=404, detail="默认对话模式不存在")
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


@app.put("/chat/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    request: ConversationUpdate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("???")
    if request.title is not None:
        conversation.title = request.title.strip() or None
    session.commit()
    session.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@app.post("/chat/conversations/{conversation_id}/title", response_model=ConversationResponse)
async def update_conversation_title(
    conversation_id: UUID,
    request: ConversationUpdate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Update conversation title via POST for compatibility with existing frontend."""
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user.sub
    ).first()
    if not conversation:
        raise NotFoundError("???")
    if request.title is not None:
        conversation.title = request.title.strip() or None
    session.commit()
    session.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


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
        raise NotFoundError("???")
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
        raise NotFoundError("???")
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
        raise NotFoundError("???")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="对话模式配置异常")

    trace["top_k"] = mode.top_k
    trace["top_n"] = mode.top_n

    user_message = Message(
        conversation_id=conversation_id, role="user", content=request.content,
        images_json=request.images if request.images else None
    )
    session.add(user_message)
    session.commit()

    chat_model_config_id = request.model_config_id
    kb_ids = request.knowledge_base_ids
    document_ids = request.document_ids

    # Step 0: Load conversation history + query rewrite
    ctx_config = conversation.context_config or {"strategy": "sliding_window", "window_size": 10}
    window_size = ctx_config.get("window_size", 10)
    history = load_conversation_history(conversation_id, session, window_size)

    start_rewrite = time.time()
    rewrite_skipped = bool(document_ids)
    search_query = request.content if rewrite_skipped else (rewrite_query(request.content, history) if history else request.content)
    trace["latency_ms"]["rewrite"] = int((time.time() - start_rewrite) * 1000)
    trace["rewrite_skipped_due_to_document_scope"] = rewrite_skipped
    trace["rewritten_query"] = search_query

    retrieval = retrieve_evidence(
        search_query,
        mode,
        session,
        knowledge_base_ids=kb_ids,
        document_ids=document_ids,
        allow_web_search=True,
        enable_web_search_override=request.enable_web_search,
    )
    final_chunks = retrieval["final_chunks"]
    citations = retrieval["citations"]
    trace.update({k: v for k, v in retrieval["trace"].items() if k != "latency_ms"})
    trace["latency_ms"].update(retrieval["trace"]["latency_ms"])

    # Step 6: Generate response
    start_llm = time.time()
    if not final_chunks and mode.require_citations:
        if mode.no_evidence_behavior == "refuse":
            answer = "抱歉，当前没有足够证据支持回答这个问题。"
        else:
            answer = "当前没有检索到足够证据，以下回答可能不够准确，请谨慎参考。"
    else:
        messages = build_context_prompt(mode, final_chunks, request.content, history if history else None)
        answer = generate_chat_response(messages, "", images=request.images,
                                        model_config_id=chat_model_config_id)

    if not final_chunks and mode.require_citations:
        answer = build_no_evidence_answer(
            mode,
            web_enabled=trace.get("web_search_enabled", False),
            web_status=trace.get("web_search_status", "disabled"),
        )
    else:
        answer = append_reference_markers(answer, citations)

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

AGENT_SYSTEM_PROMPT = """You are CypherGuard AI. Use tools when needed.

1. knowledge_search(query) - search knowledge base
2. web_search(query) - search the web
3. get_document_info(document_id) - get document metadata

Format: Thought: ... Action: tool_name("arg") Observation: [result] ... Final Answer: ...
You must end with Final Answer:."""


def run_agent(
    query: str,
    mode: Mode,
    session: Session,
    knowledge_base_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
    model_config_id: Optional[str] = None,
    enable_web_search: Optional[bool] = None,
    max_rounds: int = 5
) -> tuple:
    """Run ReACT agent loop. Returns (answer, citations, agent_steps)."""
    agent_steps = []
    all_citations = []

    messages = [
        {"role": "system", "content": (
            AGENT_SYSTEM_PROMPT + "\n\n" + (mode.system_prompt or "") +
            ("\n\nThe user has already limited the scope to selected knowledge bases or documents." if knowledge_base_ids else "")
        )},
        {"role": "user", "content": query}
    ]

    for round_num in range(max_rounds):
        response_text = generate_chat_response(messages, "", model_config_id=model_config_id)
        agent_steps.append({"round": round_num + 1, "llm_output": response_text})

        if "Final Answer:" in response_text:
            answer = response_text.split("Final Answer:")[-1].strip()
            return answer, all_citations, agent_steps

        action_match = re.search(r"Action:\s*(\w+)\((.+?)\)", response_text)
        if not action_match:
            return response_text, all_citations, agent_steps

        tool_name = action_match.group(1)
        tool_arg = parse_agent_tool_arg(action_match.group(2))
        observation = ""

        if tool_name == "knowledge_search":
            try:
                retrieval = retrieve_evidence(
                    tool_arg,
                    mode,
                    session,
                    knowledge_base_ids=knowledge_base_ids,
                    document_ids=document_ids,
                    allow_web_search=False,
                    enable_web_search_override=enable_web_search,
                )
                results = retrieval["final_chunks"]
                if results:
                    obs_parts = []
                    for r in results:
                        p = r.get("payload", {})
                        obs_parts.append(f"[{p.get('title', 'N/A')}]: {p.get('text', '')[:300]}")
                    all_citations.extend(retrieval["citations"])
                    observation = "\n".join(obs_parts)
                else:
                    observation = "知识库中未找到相关内容。"
            except Exception as e:
                session.rollback()
                observation = f"知识库检索失败: {str(e)}"

        elif tool_name == "web_search":
            if enable_web_search is False:
                observation = "当前对话已禁用联网搜索。"
            else:
                web_results = web_search(tool_arg, max_results=3)
                if web_results:
                    obs_parts = [f"[{r['payload']['title']}]: {r['payload']['text'][:200]}" for r in web_results]
                    all_citations.extend(build_citations_from_chunks(web_results))
                    observation = "\n".join(obs_parts)
                else:
                    observation = "联网搜索未返回结果。"

        elif tool_name == "get_document_info":
            try:
                from common.models import Document
                doc = session.query(Document).filter(Document.id == tool_arg).first()
                if doc:
                    observation = f"标题: {doc.title}, 类型: {doc.source_type}, 状态: {doc.status}, 标签: {doc.tags}"
                else:
                    observation = "未找到指定文档。"
            except Exception as e:
                session.rollback()
                observation = f"查询文档失败: {str(e)}"
        else:
            observation = f"未知工具: {tool_name}"

        agent_steps[-1]["action"] = f"{tool_name}({tool_arg})"
        agent_steps[-1]["observation"] = observation

        messages.append({"role": "assistant", "content": response_text})
        messages.append({"role": "user", "content": f"Observation: {observation}\n\n请继续推理，并最终给出 Final Answer。"})

    return "已达到最大推理轮次，请直接给出当前最稳妥的结论。", all_citations, agent_steps


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
        raise NotFoundError("???")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="对话模式配置异常")

    user_message = Message(
        conversation_id=conversation_id, role="user", content=request.content,
        images_json=request.images if request.images else None
    )
    session.add(user_message)
    session.commit()

    answer, citations, agent_steps = run_agent(
        request.content,
        mode,
        session,
        knowledge_base_ids=request.knowledge_base_ids,
        document_ids=request.document_ids,
        model_config_id=request.model_config_id,
        enable_web_search=request.enable_web_search,
    )
    answer = append_reference_markers(answer, citations)

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
        raise NotFoundError("???")

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
    kb_ids = request.knowledge_base_ids
    document_ids = request.document_ids

    ctx_config = conversation.context_config or {"strategy": "sliding_window", "window_size": 10}
    window_size = ctx_config.get("window_size", 10)
    history = load_conversation_history(conversation_id, session, window_size)
    search_query = request.content if document_ids else (rewrite_query(request.content, history) if history else request.content)

    async def event_stream() -> AsyncGenerator[str, None]:
        search_status = "正在联网搜索..." if (
            request.enable_web_search is True
            or (
                request.enable_web_search is None
                and getattr(mode, "enable_web_search", False)
            )
        ) else "正在检索知识库..."
        yield f"data: {json.dumps({'type': 'status', 'message': search_status}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'status', 'message': '正在整理检索结果...'}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'status', 'message': '正在重排候选内容...'}, ensure_ascii=False)}\n\n"
        retrieval = retrieve_evidence(
            search_query,
            mode,
            session,
            knowledge_base_ids=kb_ids,
            document_ids=document_ids,
            allow_web_search=True,
            enable_web_search_override=request.enable_web_search,
        )
        final_chunks = retrieval["final_chunks"]
        citations = retrieval["citations"]
        web_status = retrieval["trace"].get("web_search_status", "disabled")
        web_message = retrieval["trace"].get("web_search_message", "")
        if retrieval["trace"].get("web_search_enabled") and web_status in {"empty", "timeout", "error"}:
            fallback_web_message = web_message or "未找到相关搜索结果"
            yield f"data: {json.dumps({'type': 'status', 'message': fallback_web_message}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'status', 'message': '正在生成回答...'}, ensure_ascii=False)}\n\n"

        if not final_chunks and mode.require_citations:
            answer_text = build_no_evidence_answer(
                mode,
                web_enabled=retrieval["trace"].get("web_search_enabled", False),
                web_status=retrieval["trace"].get("web_search_status", "disabled"),
            )
            yield f"data: {json.dumps({'type': 'token', 'content': answer_text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'citations': [c.model_dump() for c in citations]}, ensure_ascii=False)}\n\n"
            assistant_msg = Message(
                conversation_id=conversation_id, role="assistant", content=answer_text,
                citations_json=[c.model_dump() for c in citations] if citations else None
            )
            session.add(assistant_msg)
            session.commit()

            if not conversation.title:
                conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
                session.commit()
            return

        if retrieval["trace"].get("web_search_enabled") and web_status in {"empty", "timeout", "error"}:
            status_payload = {"type": "status", "message": web_message or "No related search results found."}
            yield f"data: {json.dumps(status_payload, ensure_ascii=False)}\n\n"

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
            full_answer = "生成回答时出现异常，请稍后重试。"
            yield f"data: {json.dumps({'type': 'token', 'content': full_answer}, ensure_ascii=False)}\n\n"

        full_answer = append_reference_markers(full_answer, citations)
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
