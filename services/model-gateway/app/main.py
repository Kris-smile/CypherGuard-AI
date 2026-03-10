"""Model Gateway V3 - Unified model access with concurrency control, rate limiting & timeout"""

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, AsyncGenerator
from sqlalchemy.orm import Session
import os
import sys
import asyncio
import time
import logging
import json
from datetime import datetime
import redis
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import ModelConfig
from common.auth import decrypt_api_key

logger = logging.getLogger(__name__)

app = FastAPI(title="Model Gateway V3", version="3.0.0")
settings = Settings()
db = Database(settings.postgres_url)

redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

http_client = httpx.AsyncClient(timeout=120.0)

# --------------- Concurrency Control ---------------

_semaphores: Dict[str, asyncio.Semaphore] = {}


def _get_semaphore(model_type: str, max_concurrency: int) -> asyncio.Semaphore:
    key = f"{model_type}:{max_concurrency}"
    if key not in _semaphores:
        _semaphores[key] = asyncio.Semaphore(max_concurrency)
    return _semaphores[key]


async def acquire_semaphore(sem: asyncio.Semaphore, timeout: float) -> bool:
    """Try to acquire semaphore within timeout."""
    try:
        return await asyncio.wait_for(sem.acquire(), timeout=timeout)
    except asyncio.TimeoutError:
        return False


# --------------- Rate Limiting (Token Bucket via Redis) ---------------

RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local rpm = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local data = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = rpm end
if ts == nil then ts = now end
local delta = math.max(0, now - ts)
local refill = rpm / 60.0
tokens = math.min(rpm, tokens + delta * refill)
local allowed = 0
if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
end
redis.call("HMSET", key, "tokens", tokens, "ts", now)
redis.call("EXPIRE", key, 120)
return allowed
"""

_rate_limit_sha = None


def check_rate_limit(scope: str, rpm: Optional[int]) -> bool:
    """Token-bucket rate limit check. Returns True if allowed."""
    if not rpm or rpm <= 0:
        return True
    global _rate_limit_sha
    try:
        if _rate_limit_sha is None:
            _rate_limit_sha = redis_client.script_load(RATE_LIMIT_SCRIPT)
        result = redis_client.evalsha(_rate_limit_sha, 1, f"rl:{scope}", str(rpm), str(int(time.time())))
        return int(result) == 1
    except Exception as e:
        logger.warning(f"Rate limit check failed (allowing): {e}")
        return True


# --------------- DB / Helpers ---------------

def get_db():
    return next(db.get_session())


def _decrypt_key(encrypted: str) -> str:
    return decrypt_api_key(encrypted, settings.api_key_encryption_secret)


async def get_model_config(
    model_type: str,
    model_config_id: Optional[str] = None,
    session: Session = None
) -> ModelConfig:
    if session is None:
        session = next(db.get_session())
    if model_config_id:
        model = session.query(ModelConfig).filter(
            ModelConfig.id == model_config_id,
            ModelConfig.model_type == model_type,
            ModelConfig.enabled == True
        ).first()
    else:
        model = session.query(ModelConfig).filter(
            ModelConfig.model_type == model_type,
            ModelConfig.is_default == True,
            ModelConfig.enabled == True
        ).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"No enabled {model_type} model found")
    return model


# --------------- Request/Response Models ---------------

class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None
    model_config_id: Optional[str] = None

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    usage: Dict[str, int]

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
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


# ============== Provider Implementations ==============

async def call_openai_embedding(texts: List[str], mc: ModelConfig) -> EmbeddingResponse:
    api_key = _decrypt_key(mc.api_key_encrypted)
    base_url = mc.base_url or "https://api.openai.com/v1"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = await http_client.post(
        f"{base_url}/embeddings", headers=headers,
        json={"input": texts, "model": mc.model_name}
    )
    response.raise_for_status()
    data = response.json()
    return EmbeddingResponse(
        embeddings=[item["embedding"] for item in data["data"]],
        model=mc.model_name,
        usage=data.get("usage", {"prompt_tokens": 0, "total_tokens": 0})
    )


async def call_openai_chat(messages, mc: ModelConfig, temperature=0.7, max_tokens=2048) -> ChatResponse:
    api_key = _decrypt_key(mc.api_key_encrypted)
    base_url = mc.base_url or "https://api.openai.com/v1"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = await http_client.post(
        f"{base_url}/chat/completions", headers=headers,
        json={"model": mc.model_name, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    )
    response.raise_for_status()
    data = response.json()
    return ChatResponse(
        content=data["choices"][0]["message"]["content"],
        model=mc.model_name,
        usage=data.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
    )


async def call_cohere_rerank(query, documents, mc: ModelConfig, top_n=5) -> RerankResponse:
    api_key = _decrypt_key(mc.api_key_encrypted)
    base_url = mc.base_url or "https://api.cohere.ai/v1"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = await http_client.post(
        f"{base_url}/rerank", headers=headers,
        json={"model": mc.model_name, "query": query, "documents": documents, "top_n": top_n}
    )
    response.raise_for_status()
    data = response.json()
    return RerankResponse(
        results=[{"index": i["index"], "score": i["relevance_score"], "document": documents[i["index"]][:200]} for i in data["results"]],
        model=mc.model_name
    )


async def call_ollama_embedding(texts: List[str], mc: ModelConfig) -> EmbeddingResponse:
    base_url = mc.base_url or "http://localhost:11434"
    embeddings = []
    for text in texts:
        response = await http_client.post(f"{base_url}/api/embeddings", json={"model": mc.model_name, "prompt": text})
        response.raise_for_status()
        embeddings.append(response.json()["embedding"])
    return EmbeddingResponse(
        embeddings=embeddings, model=mc.model_name,
        usage={"prompt_tokens": sum(len(t.split()) for t in texts), "total_tokens": sum(len(t.split()) for t in texts)}
    )


def convert_messages_for_ollama(messages: list) -> list:
    """Convert OpenAI vision-format messages to Ollama format (images field at message level)."""
    converted = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, list):
            text_parts = []
            images = []
            for part in content:
                if part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
                elif part.get("type") == "image_url":
                    url = part.get("image_url", {}).get("url", "")
                    if url.startswith("data:"):
                        b64 = url.split(",", 1)[-1] if "," in url else url
                        images.append(b64)
            new_msg = {"role": msg["role"], "content": "\n".join(text_parts)}
            if images:
                new_msg["images"] = images
            converted.append(new_msg)
        else:
            converted.append(msg)
    return converted


async def call_ollama_chat(messages, mc: ModelConfig, temperature=0.7, max_tokens=2048) -> ChatResponse:
    base_url = mc.base_url or "http://localhost:11434"
    ollama_messages = convert_messages_for_ollama(messages)
    response = await http_client.post(
        f"{base_url}/api/chat",
        json={"model": mc.model_name, "messages": ollama_messages, "stream": False, "options": {"temperature": temperature, "num_predict": max_tokens}}
    )
    response.raise_for_status()
    data = response.json()
    return ChatResponse(
        content=data["message"]["content"], model=mc.model_name,
        usage={"prompt_tokens": data.get("prompt_eval_count", 0), "completion_tokens": data.get("eval_count", 0), "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0)}
    )


# ============== Mock Fallbacks ==============

def _mock_embedding(text: str, dim=384) -> List[float]:
    import hashlib
    h = hashlib.sha256(text.encode()).digest()
    emb = [(h[i % len(h)] + i) / 255.0 - 0.5 for i in range(dim)]
    norm = sum(x * x for x in emb) ** 0.5
    return [x / norm for x in emb]

async def mock_embedding(texts): return EmbeddingResponse(embeddings=[_mock_embedding(t) for t in texts], model="mock-embedding-384", usage={"prompt_tokens": 0, "total_tokens": 0})
async def mock_chat(messages): return ChatResponse(content="这是模拟回复。请在设置中配置真实模型。", model="mock-chat", usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
async def mock_rerank(query, docs, top_n=5):
    qw = set(query.lower().split())
    scored = [{"index": i, "score": len(qw & set(d.lower().split())) / max(len(qw), 1), "document": d[:200]} for i, d in enumerate(docs)]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return RerankResponse(results=scored[:top_n], model="mock-rerank")


# ============== Dispatch with Concurrency + Rate Limit ==============

async def _dispatch_with_controls(model_type: str, model_config_id: Optional[str], call_fn):
    """Wrap a model call with semaphore, rate limit, and timeout."""
    session = next(db.get_session())
    try:
        mc = await get_model_config(model_type, model_config_id, session)
    except HTTPException:
        return None, None  # caller handles fallback

    max_conc = mc.max_concurrency or 4
    rpm = mc.rate_limit_rpm
    timeout_s = {
        "embedding": settings.model_gateway_timeout_seconds_embedding,
        "chat": settings.model_gateway_timeout_seconds_chat,
        "rerank": settings.model_gateway_timeout_seconds_rerank,
    }.get(model_type, 60)

    scope = f"{model_type}:{mc.id}"
    if not check_rate_limit(scope, rpm):
        raise HTTPException(status_code=429, detail=f"模型 {mc.name} 请求频率超限，请稍后重试")

    sem = _get_semaphore(f"{mc.id}", max_conc)
    acquired = await acquire_semaphore(sem, settings.model_gateway_acquire_timeout_seconds)
    if not acquired:
        raise HTTPException(status_code=503, detail=f"模型 {mc.name} 当前繁忙（并发已满），请稍后重试")

    try:
        result = await asyncio.wait_for(call_fn(mc), timeout=timeout_s)
        return result, mc
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"模型 {mc.name} 响应超时 ({timeout_s}s)")
    finally:
        sem.release()


# ============== API Endpoints ==============

@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    return "OK"

@app.get("/internal/health", response_class=PlainTextResponse)
async def internal_health():
    return "Model Gateway V3 OK"


@app.post("/internal/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    async def call(mc):
        if mc.provider in ("openai", "azure_openai"):
            return await call_openai_embedding(request.texts, mc)
        elif mc.provider == "ollama":
            return await call_ollama_embedding(request.texts, mc)
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {mc.provider}")

    try:
        result, mc = await _dispatch_with_controls("embedding", request.model_config_id, call)
        if result:
            return result
    except HTTPException as e:
        if e.status_code in (429, 503, 504):
            raise
        logger.warning(f"Embedding dispatch error: {e.detail}, using mock")

    return await mock_embedding(request.texts)


@app.post("/internal/chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest):
    async def call(mc):
        if mc.provider in ("openai", "azure_openai"):
            return await call_openai_chat(request.messages, mc, request.temperature, request.max_tokens)
        elif mc.provider == "ollama":
            return await call_ollama_chat(request.messages, mc, request.temperature, request.max_tokens)
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {mc.provider}")

    try:
        result, mc = await _dispatch_with_controls("chat", request.model_config_id, call)
        if result:
            return result
    except HTTPException as e:
        if e.status_code in (429, 503, 504):
            raise
        logger.warning(f"Chat dispatch error: {e.detail}, using mock")

    return await mock_chat(request.messages)


@app.post("/internal/rerank", response_model=RerankResponse)
async def rerank_documents_endpoint(request: RerankRequest):
    async def call(mc):
        if mc.provider == "cohere":
            return await call_cohere_rerank(request.query, request.documents, mc, request.top_n)
        raise HTTPException(status_code=400, detail=f"Unsupported rerank provider: {mc.provider}")

    try:
        result, mc = await _dispatch_with_controls("rerank", request.model_config_id, call)
        if result:
            return result
    except HTTPException as e:
        if e.status_code in (429, 503, 504):
            raise
        logger.warning(f"Rerank dispatch error: {e.detail}, using mock")

    return await mock_rerank(request.query, request.documents, request.top_n)


# ============== Streaming Chat ==============

async def stream_openai_chat(messages, mc: ModelConfig, temperature=0.7, max_tokens=2048) -> AsyncGenerator[str, None]:
    api_key = _decrypt_key(mc.api_key_encrypted)
    base_url = mc.base_url or "https://api.openai.com/v1"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST", f"{base_url}/chat/completions", headers=headers,
            json={"model": mc.model_name, "messages": messages, "temperature": temperature,
                  "max_tokens": max_tokens, "stream": True}
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
                    except json.JSONDecodeError:
                        continue


async def stream_ollama_chat(messages, mc: ModelConfig, temperature=0.7, max_tokens=2048) -> AsyncGenerator[str, None]:
    base_url = mc.base_url or "http://localhost:11434"
    ollama_messages = convert_messages_for_ollama(messages)
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST", f"{base_url}/api/chat",
            json={"model": mc.model_name, "messages": ollama_messages, "stream": True,
                  "options": {"temperature": temperature, "num_predict": max_tokens}}
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
                    if data.get("done", False):
                        yield "data: [DONE]\n\n"
                        break
                except json.JSONDecodeError:
                    continue


@app.post("/internal/chat/stream")
async def create_chat_stream(request: ChatRequest):
    """Streaming chat endpoint — returns SSE."""
    session = next(db.get_session())
    try:
        mc = await get_model_config("chat", request.model_config_id, session)
    except HTTPException:
        async def mock_stream():
            yield f"data: {json.dumps({'type': 'token', 'content': '这是模拟流式回复。请在设置中配置真实模型。'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(mock_stream(), media_type="text/event-stream")

    scope = f"chat:{mc.id}"
    if not check_rate_limit(scope, mc.rate_limit_rpm):
        raise HTTPException(status_code=429, detail="请求频率超限")

    sem = _get_semaphore(f"{mc.id}", mc.max_concurrency or 4)
    acquired = await acquire_semaphore(sem, settings.model_gateway_acquire_timeout_seconds)
    if not acquired:
        raise HTTPException(status_code=503, detail="模型当前繁忙")

    async def generate():
        try:
            if mc.provider in ("openai", "azure_openai"):
                async for chunk in stream_openai_chat(request.messages, mc, request.temperature, request.max_tokens):
                    yield chunk
            elif mc.provider == "ollama":
                async for chunk in stream_ollama_chat(request.messages, mc, request.temperature, request.max_tokens):
                    yield chunk
            else:
                yield f"data: {json.dumps({'type': 'token', 'content': '不支持的模型提供商'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            sem.release()

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
