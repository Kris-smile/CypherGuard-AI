"""Chat Service - RAG-based conversational AI with citations"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient
from typing import List, Optional
from uuid import UUID
import httpx
import time
import sys
import os

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User, Mode, Conversation, Message
from common.schemas import (
    ConversationCreate, ConversationResponse,
    MessageCreate, MessageResponse,
    ModeResponse, ChatResponse, Citation
)

# Initialize app
app = FastAPI(
    title="Chat Service",
    version="1.0.0",
    docs_url="/chat/docs",
    openapi_url="/chat/openapi.json",
    redoc_url="/chat/redoc"
)
settings = Settings()
db = Database(settings.postgres_url)

# Qdrant client
qdrant_client = QdrantClient(url=settings.qdrant_url)
COLLECTION_NAME = "kb_chunks_v1"

# Model gateway URL
MODEL_GATEWAY_URL = os.getenv("MODEL_GATEWAY_URL", "http://model-gateway:8000")


def get_db():
    return next(db.get_session())


async def get_current_user_id(user_id: str = None) -> str:
    """Get current user ID from header (simplified for Phase 4)"""
    if not user_id:
        return "00000000-0000-0000-0000-000000000001"
    return user_id


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.get("/chat/healthz", response_class=PlainTextResponse)
async def chat_health_check():
    """Chat service health check"""
    return "Chat Service OK"


# ============== RAG Helper Functions ==============

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings from model gateway"""
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{MODEL_GATEWAY_URL}/internal/embeddings",
            json={"texts": texts}
        )
        response.raise_for_status()
        return response.json()["embeddings"]


def search_qdrant(query_vector: List[float], top_k: int = 20) -> List[dict]:
    """Search Qdrant for similar chunks"""
    try:
        results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k,
            with_payload=True
        )
        return [
            {
                "id": str(r.id),
                "score": r.score,
                "payload": r.payload
            }
            for r in results
        ]
    except Exception as e:
        print(f"[Chat] Qdrant search error: {e}")
        return []


def rerank_documents(query: str, documents: List[str], top_n: int = 6) -> List[dict]:
    """Rerank documents using model gateway"""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{MODEL_GATEWAY_URL}/internal/rerank",
                json={
                    "query": query,
                    "documents": documents,
                    "top_n": top_n
                }
            )
            response.raise_for_status()
            return response.json()["results"]
    except Exception as e:
        print(f"[Chat] Rerank error: {e}, falling back to vector scores")
        return None


def generate_chat_response(messages: List[dict], context: str) -> str:
    """Generate chat response using model gateway"""
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{MODEL_GATEWAY_URL}/internal/chat",
            json={"messages": messages}
        )
        response.raise_for_status()
        return response.json()["content"]


def build_context_prompt(mode: Mode, chunks: List[dict], query: str) -> List[dict]:
    """Build the prompt with context for the LLM"""
    context_parts = []
    for i, chunk in enumerate(chunks):
        payload = chunk.get("payload", chunk)
        text = payload.get("text", "")
        title = payload.get("title", "Unknown")
        context_parts.append(f"[Source {i+1}: {title}]\n{text}\n")

    context_text = "\n".join(context_parts)

    messages = [
        {
            "role": "system",
            "content": f"{mode.system_prompt}\n\nContext from knowledge base:\n{context_text}"
        },
        {
            "role": "user",
            "content": query
        }
    ]
    return messages


# ============== API Endpoints ==============

@app.get("/chat/modes", response_model=List[ModeResponse])
async def list_modes(session: Session = Depends(get_db)):
    """List available chat modes"""
    modes = session.query(Mode).all()
    return [ModeResponse.model_validate(m) for m in modes]


@app.post("/chat/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: ConversationCreate,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Create a new conversation"""
    mode = session.query(Mode).filter(Mode.name == request.mode_name).first()
    if not mode:
        mode = session.query(Mode).filter(Mode.name == "quick").first()
        if not mode:
            raise HTTPException(status_code=404, detail="No modes available")

    conversation = Conversation(
        user_id=user_id,
        mode_id=mode.id,
        title=request.title
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)

    return ConversationResponse.model_validate(conversation)


@app.get("/chat/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """List user's conversations"""
    conversations = session.query(Conversation).filter(
        Conversation.user_id == user_id
    ).order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()

    return [ConversationResponse.model_validate(c) for c in conversations]


@app.get("/chat/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Get messages in a conversation"""
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = session.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()

    return [MessageResponse.model_validate(m) for m in messages]


@app.post("/chat/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(
    conversation_id: UUID,
    request: MessageCreate,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Send a message and get RAG-based response with citations"""
    trace = {"top_k": 0, "top_n": 0, "latency_ms": {}}
    start_total = time.time()

    # Get conversation and mode
    conversation = session.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    mode = session.query(Mode).filter(Mode.id == conversation.mode_id).first()
    if not mode:
        raise HTTPException(status_code=500, detail="Mode not found")

    trace["top_k"] = mode.top_k
    trace["top_n"] = mode.top_n

    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=request.content
    )
    session.add(user_message)
    session.commit()

    # Step 1: Generate embedding for query
    start_embed = time.time()
    query_embeddings = get_embeddings([request.content])
    query_vector = query_embeddings[0]
    trace["latency_ms"]["embed"] = int((time.time() - start_embed) * 1000)

    # Step 2: Search Qdrant
    start_search = time.time()
    search_results = search_qdrant(query_vector, top_k=mode.top_k)
    trace["latency_ms"]["search"] = int((time.time() - start_search) * 1000)

    # Step 3: Rerank results
    start_rerank = time.time()
    if search_results:
        documents = [r["payload"]["text"] for r in search_results]
        rerank_results = rerank_documents(request.content, documents, top_n=mode.top_n)

        if rerank_results:
            # Reorder search results based on rerank scores
            reranked_chunks = []
            for rr in rerank_results:
                idx = rr["index"]
                if idx < len(search_results):
                    chunk = search_results[idx].copy()
                    chunk["rerank_score"] = rr["score"]
                    reranked_chunks.append(chunk)
            final_chunks = reranked_chunks
        else:
            # Fallback: use top_n from vector search
            final_chunks = search_results[:mode.top_n]
    else:
        final_chunks = []
    trace["latency_ms"]["rerank"] = int((time.time() - start_rerank) * 1000)

    # Step 4: Check if we have evidence
    citations = []
    if final_chunks:
        # Filter by min_score if required
        if mode.min_score > 0:
            final_chunks = [c for c in final_chunks if c.get("score", 0) >= mode.min_score]

    # Build citations from final chunks
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
            score=chunk.get("rerank_score", chunk.get("score", 0))
        ))

    # Step 5: Generate response
    start_llm = time.time()

    if not final_chunks and mode.require_citations:
        if mode.no_evidence_behavior == "refuse":
            answer = "I cannot find relevant information in the knowledge base to answer your question. Please try rephrasing or ask about topics covered in the uploaded documents."
        else:
            answer = "[Warning: No evidence found] I don't have specific information from the knowledge base to answer this question accurately."
    else:
        # Build prompt with context
        messages = build_context_prompt(mode, final_chunks, request.content)
        answer = generate_chat_response(messages, "")

    trace["latency_ms"]["llm"] = int((time.time() - start_llm) * 1000)
    trace["latency_ms"]["total"] = int((time.time() - start_total) * 1000)

    # Save assistant message
    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=answer,
        citations_json=[c.model_dump() for c in citations] if citations else None
    )
    session.add(assistant_message)
    session.commit()

    # Update conversation title if first message
    if not conversation.title:
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
        session.commit()

    return ChatResponse(
        answer=answer,
        citations=citations,
        mode=mode.name,
        trace=trace
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
