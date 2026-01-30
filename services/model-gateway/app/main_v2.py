"""Model Gateway V2 - Real AI model integration with OpenAI, Cohere, and Ollama"""

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import os
import sys
import asyncio
import time
from datetime import datetime
import redis
import httpx

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import ModelConfig

# Initialize app
app = FastAPI(title="Model Gateway V2", version="2.0.0")
settings = Settings()
db = Database(settings.postgres_url)

# Redis client for rate limiting
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# HTTP client with timeout
http_client = httpx.AsyncClient(timeout=60.0)


def get_db():
    return next(db.get_session())


def decrypt_api_key(encrypted: str) -> str:
    """Decrypt API key (simple base64 for now)"""
    import base64
    return base64.b64decode(encrypted.encode()).decode()


async def get_model_config(
    model_type: str,
    model_config_id: Optional[str] = None,
    session: Session = Depends(get_db)
) -> ModelConfig:
    """Get model configuration from database"""
    if model_config_id:
        model = session.query(ModelConfig).filter(
            ModelConfig.id == model_config_id,
            ModelConfig.model_type == model_type,
            ModelConfig.enabled == True
        ).first()
    else:
        # Get default model for this type
        model = session.query(ModelConfig).filter(
            ModelConfig.model_type == model_type,
            ModelConfig.is_default == True,
            ModelConfig.enabled == True
        ).first()
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No enabled {model_type} model configuration found"
        )
    
    return model


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


# ============== OpenAI Integration ==============

async def call_openai_embedding(
    texts: List[str],
    model_config: ModelConfig
) -> EmbeddingResponse:
    """Call OpenAI Embedding API"""
    api_key = decrypt_api_key(model_config.api_key_encrypted)
    base_url = model_config.base_url or "https://api.openai.com/v1"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "input": texts,
        "model": model_config.model_name
    }
    
    try:
        response = await http_client.post(
            f"{base_url}/embeddings",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        
        embeddings = [item["embedding"] for item in data["data"]]
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model=model_config.model_name,
            usage=data.get("usage", {
                "prompt_tokens": sum(len(t.split()) for t in texts),
                "total_tokens": sum(len(t.split()) for t in texts)
            })
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"OpenAI API error: {e.response.text}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to call OpenAI API: {str(e)}"
        )


async def call_openai_chat(
    messages: List[Dict[str, str]],
    model_config: ModelConfig,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> ChatResponse:
    """Call OpenAI Chat API"""
    api_key = decrypt_api_key(model_config.api_key_encrypted)
    base_url = model_config.base_url or "https://api.openai.com/v1"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_config.model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    try:
        response = await http_client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        
        return ChatResponse(
            content=content,
            model=model_config.model_name,
            usage=data.get("usage", {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            })
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"OpenAI API error: {e.response.text}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to call OpenAI API: {str(e)}"
        )


# ============== Cohere Integration ==============

async def call_cohere_rerank(
    query: str,
    documents: List[str],
    model_config: ModelConfig,
    top_n: int = 5
) -> RerankResponse:
    """Call Cohere Rerank API"""
    api_key = decrypt_api_key(model_config.api_key_encrypted)
    base_url = model_config.base_url or "https://api.cohere.ai/v1"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_config.model_name,
        "query": query,
        "documents": documents,
        "top_n": top_n
    }
    
    try:
        response = await http_client.post(
            f"{base_url}/rerank",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        
        results = [
            {
                "index": item["index"],
                "score": item["relevance_score"],
                "document": documents[item["index"]][:200]
            }
            for item in data["results"]
        ]
        
        return RerankResponse(
            results=results,
            model=model_config.model_name
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cohere API error: {e.response.text}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to call Cohere API: {str(e)}"
        )


# ============== Ollama Integration ==============

async def call_ollama_embedding(
    texts: List[str],
    model_config: ModelConfig
) -> EmbeddingResponse:
    """Call Ollama Embedding API"""
    base_url = model_config.base_url or "http://localhost:11434"
    
    embeddings = []
    for text in texts:
        try:
            response = await http_client.post(
                f"{base_url}/api/embeddings",
                json={
                    "model": model_config.model_name,
                    "prompt": text
                }
            )
            response.raise_for_status()
            data = response.json()
            embeddings.append(data["embedding"])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to call Ollama API: {str(e)}"
            )
    
    return EmbeddingResponse(
        embeddings=embeddings,
        model=model_config.model_name,
        usage={
            "prompt_tokens": sum(len(t.split()) for t in texts),
            "total_tokens": sum(len(t.split()) for t in texts)
        }
    )


async def call_ollama_chat(
    messages: List[Dict[str, str]],
    model_config: ModelConfig,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> ChatResponse:
    """Call Ollama Chat API"""
    base_url = model_config.base_url or "http://localhost:11434"
    
    try:
        response = await http_client.post(
            f"{base_url}/api/chat",
            json={
                "model": model_config.model_name,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            }
        )
        response.raise_for_status()
        data = response.json()
        
        content = data["message"]["content"]
        
        return ChatResponse(
            content=content,
            model=model_config.model_name,
            usage={
                "prompt_tokens": data.get("prompt_eval_count", 0),
                "completion_tokens": data.get("eval_count", 0),
                "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to call Ollama API: {str(e)}"
        )


# ============== Mock Functions (Fallback) ==============

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


async def call_mock_embedding(texts: List[str]) -> EmbeddingResponse:
    """Mock embedding for testing"""
    embeddings = [generate_mock_embedding(text) for text in texts]
    return EmbeddingResponse(
        embeddings=embeddings,
        model="mock-embedding-384",
        usage={
            "prompt_tokens": sum(len(t.split()) for t in texts),
            "total_tokens": sum(len(t.split()) for t in texts)
        }
    )


async def call_mock_chat(messages: List[Dict[str, str]]) -> ChatResponse:
    """Mock chat for testing"""
    return ChatResponse(
        content="This is a mock response. Please configure a real model in Settings.",
        model="mock-chat",
        usage={
            "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
            "completion_tokens": 15,
            "total_tokens": sum(len(m.get("content", "").split()) for m in messages) + 15
        }
    )


async def call_mock_rerank(query: str, documents: List[str], top_n: int = 5) -> RerankResponse:
    """Mock rerank for testing"""
    results = []
    query_words = set(query.lower().split())
    
    for i, doc in enumerate(documents):
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
        results=results[:top_n],
        model="mock-rerank"
    )


# ============== API Endpoints ==============

@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.get("/internal/health", response_class=PlainTextResponse)
async def internal_health():
    """Internal health check"""
    return "Model Gateway V2 OK"


@app.post("/internal/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(
    request: EmbeddingRequest,
    session: Session = Depends(get_db)
):
    """Generate embeddings using configured model"""
    try:
        # Get model configuration
        model_config = await get_model_config("embedding", request.model_config_id, session)
        
        # Route to appropriate provider
        if model_config.provider == "openai" or model_config.provider == "azure_openai":
            return await call_openai_embedding(request.texts, model_config)
        elif model_config.provider == "ollama":
            return await call_ollama_embedding(request.texts, model_config)
        else:
            # Fallback to mock
            print(f"[Model Gateway] Unknown provider {model_config.provider}, using mock")
            return await call_mock_embedding(request.texts)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Model Gateway] Error in embeddings: {e}, falling back to mock")
        return await call_mock_embedding(request.texts)


@app.post("/internal/chat", response_model=ChatResponse)
async def create_chat(
    request: ChatRequest,
    session: Session = Depends(get_db)
):
    """Generate chat completion using configured model"""
    try:
        # Get model configuration
        model_config = await get_model_config("chat", request.model_config_id, session)
        
        # Route to appropriate provider
        if model_config.provider == "openai" or model_config.provider == "azure_openai":
            return await call_openai_chat(
                request.messages,
                model_config,
                request.temperature,
                request.max_tokens
            )
        elif model_config.provider == "ollama":
            return await call_ollama_chat(
                request.messages,
                model_config,
                request.temperature,
                request.max_tokens
            )
        else:
            # Fallback to mock
            print(f"[Model Gateway] Unknown provider {model_config.provider}, using mock")
            return await call_mock_chat(request.messages)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Model Gateway] Error in chat: {e}, falling back to mock")
        return await call_mock_chat(request.messages)


@app.post("/internal/rerank", response_model=RerankResponse)
async def rerank_documents(
    request: RerankRequest,
    session: Session = Depends(get_db)
):
    """Rerank documents using configured model"""
    try:
        # Get model configuration
        model_config = await get_model_config("rerank", request.model_config_id, session)
        
        # Route to appropriate provider
        if model_config.provider == "cohere":
            return await call_cohere_rerank(
                request.query,
                request.documents,
                model_config,
                request.top_n
            )
        else:
            # Fallback to mock
            print(f"[Model Gateway] Unknown provider {model_config.provider}, using mock")
            return await call_mock_rerank(request.query, request.documents, request.top_n)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Model Gateway] Error in rerank: {e}, falling back to mock")
        return await call_mock_rerank(request.query, request.documents, request.top_n)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await http_client.aclose()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
