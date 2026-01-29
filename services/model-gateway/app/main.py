"""Model Gateway - Unified model access with rate limiting and fallback"""

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
import sys
import asyncio
from datetime import datetime

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings

# Initialize app
app = FastAPI(title="Model Gateway", version="1.0.0")
settings = Settings()

# Semaphore for concurrency control
embedding_semaphore = asyncio.Semaphore(4)
chat_semaphore = asyncio.Semaphore(4)


# Request/Response models
class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    usage: Dict[str, int]


class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048


class ChatResponse(BaseModel):
    content: str
    model: str
    usage: Dict[str, int]


class RerankRequest(BaseModel):
    query: str
    documents: List[str]
    model: Optional[str] = None
    top_n: Optional[int] = 5


class RerankResponse(BaseModel):
    results: List[Dict[str, Any]]
    model: str


# Mock embedding function for Phase 3 (replace with real API calls later)
def generate_mock_embedding(text: str, dimension: int = 384) -> List[float]:
    """Generate a deterministic mock embedding based on text hash"""
    import hashlib
    hash_bytes = hashlib.sha256(text.encode()).digest()
    embedding = []
    for i in range(dimension):
        byte_idx = i % len(hash_bytes)
        value = (hash_bytes[byte_idx] + i) / 255.0 - 0.5
        embedding.append(value)
    # Normalize
    norm = sum(x*x for x in embedding) ** 0.5
    return [x / norm for x in embedding]


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.get("/internal/health", response_class=PlainTextResponse)
async def internal_health():
    """Internal health check"""
    return "Model Gateway OK"


@app.post("/internal/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """Generate embeddings for a list of texts"""
    async with embedding_semaphore:
        start_time = datetime.now()

        # For Phase 3, use mock embeddings
        # In production, this would call OpenAI/Ollama/etc.
        embeddings = [generate_mock_embedding(text) for text in request.texts]

        elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000
        print(f"[Model Gateway] Generated {len(embeddings)} embeddings in {elapsed_ms:.0f}ms")

        return EmbeddingResponse(
            embeddings=embeddings,
            model=request.model or "mock-embedding-384",
            usage={
                "prompt_tokens": sum(len(t.split()) for t in request.texts),
                "total_tokens": sum(len(t.split()) for t in request.texts)
            }
        )


@app.post("/internal/chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest):
    """Generate chat completion"""
    async with chat_semaphore:
        # For Phase 3, return a mock response
        # In production, this would call OpenAI/Ollama/etc.
        return ChatResponse(
            content="This is a mock response. Configure a real model to get actual responses.",
            model=request.model or "mock-chat",
            usage={
                "prompt_tokens": sum(len(m.get("content", "").split()) for m in request.messages),
                "completion_tokens": 15,
                "total_tokens": sum(len(m.get("content", "").split()) for m in request.messages) + 15
            }
        )


@app.post("/internal/rerank", response_model=RerankResponse)
async def rerank_documents(request: RerankRequest):
    """Rerank documents based on query relevance"""
    # For Phase 3, use simple keyword matching as mock reranking
    results = []
    query_words = set(request.query.lower().split())

    for i, doc in enumerate(request.documents):
        doc_words = set(doc.lower().split())
        overlap = len(query_words & doc_words)
        score = overlap / max(len(query_words), 1)
        results.append({
            "index": i,
            "score": score,
            "document": doc[:200]  # Truncate for response
        })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    # Return top_n results
    return RerankResponse(
        results=results[:request.top_n],
        model=request.model or "mock-rerank"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
