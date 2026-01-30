"""Model Gateway - Unified model access with rate limiting and fallback"""

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import sys
import asyncio
import time
from datetime import datetime
import redis

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings

# Initialize app
app = FastAPI(title="Model Gateway", version="1.0.0")
settings = Settings()

# Semaphore for concurrency control
embedding_semaphore = asyncio.Semaphore(settings.model_gateway_max_concurrency_embedding)
chat_semaphore = asyncio.Semaphore(settings.model_gateway_max_concurrency_chat)
rerank_semaphore = asyncio.Semaphore(settings.model_gateway_max_concurrency_rerank)

# Redis client for rate limiting
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# Token bucket script: returns {allowed, remaining_tokens}
RATE_LIMIT_SCRIPT = redis_client.register_script(
    """
    local key = KEYS[1]
    local rate = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local data = redis.call("HMGET", key, "tokens", "ts")
    local tokens = tonumber(data[1])
    local ts = tonumber(data[2])
    if tokens == nil then tokens = capacity end
    if ts == nil then ts = now end
    local delta = math.max(0, now - ts)
    local refill = rate / 60.0
    tokens = math.min(capacity, tokens + delta * refill)
    local allowed = 0
    if tokens >= 1 then
      tokens = tokens - 1
      allowed = 1
    end
    redis.call("HMSET", key, "tokens", tokens, "ts", now)
    redis.call("EXPIRE", key, math.ceil(120))
    return {allowed, tokens}
    """
)


# Request/Response models
class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None
    model_config_id: Optional[str] = None


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    usage: Dict[str, int]


class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    model_config_id: Optional[str] = None
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
    model_config_id: Optional[str] = None
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


def rate_limit_scope(kind: str, request: BaseModel) -> str:
    """Build a stable rate-limit scope key."""
    model_config_id = getattr(request, "model_config_id", None)
    model = getattr(request, "model", None)
    if model_config_id:
        return f"{kind}:cfg:{model_config_id}"
    if model:
        return f"{kind}:model:{model}"
    return f"{kind}:default"


def check_rate_limit(scope: str, rpm: Optional[int]) -> bool:
    """Token-bucket rate limit check using Redis."""
    if not rpm or rpm <= 0:
        return True
    try:
        now = int(time.time())
        result = RATE_LIMIT_SCRIPT(keys=[f"rl:{scope}"], args=[rpm, rpm, now])
        allowed = int(result[0]) == 1
        return allowed
    except Exception as e:
        print(f"[Model Gateway] Rate limit check failed: {e}")
        return True


async def try_acquire(semaphore: asyncio.Semaphore, timeout: float) -> bool:
    """Attempt to acquire semaphore within timeout."""
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        return False


async def run_with_timeout(coro, timeout_seconds: int, label: str):
    """Run a coroutine with timeout, raise HTTP 504 on timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"{label} timeout"
        )


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
    scope = rate_limit_scope("embedding", request)
    if not check_rate_limit(scope, settings.model_gateway_rate_limit_rpm_embedding):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    acquired = await try_acquire(embedding_semaphore, settings.model_gateway_acquire_timeout_seconds)
    if not acquired:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Model gateway busy")

    start_total = time.perf_counter()
    status_code = status.HTTP_200_OK
    try:
        async def _do_embeddings():
            start_time = datetime.now()
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

        return await run_with_timeout(
            _do_embeddings(),
            settings.model_gateway_timeout_seconds_embedding,
            "embedding"
        )
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    except Exception:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise
    finally:
        embedding_semaphore.release()
        total_ms = int((time.perf_counter() - start_total) * 1000)
        print(f"[Model Gateway] embeddings scope={scope} status={status_code} latency_ms={total_ms}")


@app.post("/internal/chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest):
    """Generate chat completion"""
    scope = rate_limit_scope("chat", request)
    if not check_rate_limit(scope, settings.model_gateway_rate_limit_rpm_chat):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    acquired = await try_acquire(chat_semaphore, settings.model_gateway_acquire_timeout_seconds)
    if not acquired:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Model gateway busy")

    start_total = time.perf_counter()
    status_code = status.HTTP_200_OK
    try:
        async def _do_chat():
            return ChatResponse(
                content="This is a mock response. Configure a real model to get actual responses.",
                model=request.model or "mock-chat",
                usage={
                    "prompt_tokens": sum(len(m.get("content", "").split()) for m in request.messages),
                    "completion_tokens": 15,
                    "total_tokens": sum(len(m.get("content", "").split()) for m in request.messages) + 15
                }
            )

        return await run_with_timeout(
            _do_chat(),
            settings.model_gateway_timeout_seconds_chat,
            "chat"
        )
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    except Exception:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise
    finally:
        chat_semaphore.release()
        total_ms = int((time.perf_counter() - start_total) * 1000)
        print(f"[Model Gateway] chat scope={scope} status={status_code} latency_ms={total_ms}")


@app.post("/internal/rerank", response_model=RerankResponse)
async def rerank_documents(request: RerankRequest):
    """Rerank documents based on query relevance"""
    scope = rate_limit_scope("rerank", request)
    if not check_rate_limit(scope, settings.model_gateway_rate_limit_rpm_rerank):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    acquired = await try_acquire(rerank_semaphore, settings.model_gateway_acquire_timeout_seconds)
    if not acquired:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Model gateway busy")

    start_total = time.perf_counter()
    status_code = status.HTTP_200_OK
    try:
        async def _do_rerank():
            results = []
            query_words = set(request.query.lower().split())

            for i, doc in enumerate(request.documents):
                doc_words = set(doc.lower().split())
                overlap = len(query_words & doc_words)
                score = overlap / max(len(query_words), 1)
                results.append({
                    "index": i,
                    "score": score,
                    "document": doc[:200]
                })

            results.sort(key=lambda x: x["score"], reverse=True)

            return RerankResponse(
                results=results[:request.top_n],
                model=request.model or "mock-rerank"
            )

        return await run_with_timeout(
            _do_rerank(),
            settings.model_gateway_timeout_seconds_rerank,
            "rerank"
        )
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    except Exception:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise
    finally:
        rerank_semaphore.release()
        total_ms = int((time.perf_counter() - start_total) * 1000)
        print(f"[Model Gateway] rerank scope={scope} status={status_code} latency_ms={total_ms}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
