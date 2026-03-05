"""Model Config Service - Model configuration management with RBAC"""

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import sys
import os
import logging
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import ModelConfig
from common.schemas import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse
from common.auth import (
    decode_token_payload, TokenPayload,
    encrypt_api_key, decrypt_api_key
)
from common.exceptions import NotFoundError, ConflictError, AuthenticationError, AuthorizationError

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Model Config Service",
    version="2.0.0",
    docs_url="/models/docs",
    openapi_url="/models/openapi.json",
    redoc_url="/models/redoc"
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
        raise AuthorizationError("模型配置管理需要管理员权限")
    return user


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    return "OK"


@app.get("/models", response_model=List[ModelConfigResponse])
async def list_models(
    session: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user)
):
    models = session.query(ModelConfig).order_by(
        ModelConfig.is_default.desc(), ModelConfig.created_at.desc()
    ).all()
    return [ModelConfigResponse.model_validate(m) for m in models]


@app.get("/models/{model_id}", response_model=ModelConfigResponse)
async def get_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user)
):
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise NotFoundError("模型配置未找到")
    return ModelConfigResponse.model_validate(model)


@app.post("/models", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: ModelConfigCreate,
    session: Session = Depends(get_db),
    admin: TokenPayload = Depends(require_admin)
):
    """Create a new model configuration (admin only)."""
    existing = session.query(ModelConfig).filter(ModelConfig.name == data.name).first()
    if existing:
        raise ConflictError("同名模型配置已存在")

    encrypted_key = encrypt_api_key(data.api_key, settings.api_key_encryption_secret)

    model = ModelConfig(
        name=data.name,
        model_type=data.model_type,
        provider=data.provider,
        base_url=data.base_url,
        model_name=data.model_name,
        api_key_encrypted=encrypted_key,
        is_default=False,
        params_json=data.params_json,
        max_concurrency=data.max_concurrency,
        rate_limit_rpm=data.rate_limit_rpm,
        enabled=data.enabled
    )

    count = session.query(ModelConfig).filter(ModelConfig.model_type == data.model_type).count()
    if count == 0:
        model.is_default = True

    session.add(model)
    session.commit()
    session.refresh(model)
    return ModelConfigResponse.model_validate(model)


@app.put("/models/{model_id}", response_model=ModelConfigResponse)
async def update_model(
    model_id: UUID,
    data: ModelConfigUpdate,
    session: Session = Depends(get_db),
    admin: TokenPayload = Depends(require_admin)
):
    """Update model configuration (admin only)."""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise NotFoundError("模型配置未找到")

    update_data = data.model_dump(exclude_unset=True)

    if 'api_key' in update_data and update_data['api_key']:
        update_data['api_key_encrypted'] = encrypt_api_key(
            update_data.pop('api_key'), settings.api_key_encryption_secret
        )
    elif 'api_key' in update_data:
        update_data.pop('api_key')

    for key, value in update_data.items():
        setattr(model, key, value)

    session.commit()
    session.refresh(model)
    return ModelConfigResponse.model_validate(model)


@app.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    admin: TokenPayload = Depends(require_admin)
):
    """Delete model configuration (admin only)."""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise NotFoundError("模型配置未找到")
    if model.is_default:
        raise HTTPException(status_code=400, detail="不能删除默认模型，请先设置其他模型为默认")
    session.delete(model)
    session.commit()
    return None


@app.post("/models/{model_id}/set-default", status_code=status.HTTP_200_OK)
async def set_default_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    admin: TokenPayload = Depends(require_admin)
):
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise NotFoundError("模型配置未找到")
    session.query(ModelConfig).filter(
        ModelConfig.model_type == model.model_type
    ).update({"is_default": False})
    model.is_default = True
    session.commit()
    return {"message": "默认模型已更新"}


@app.post("/models/{model_id}/test")
async def test_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    admin: TokenPayload = Depends(require_admin)
):
    """Test model configuration by making a real API call."""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise NotFoundError("模型配置未找到")
    if not model.enabled:
        return {"success": False, "message": "模型已禁用"}

    try:
        api_key = decrypt_api_key(model.api_key_encrypted, settings.api_key_encryption_secret)
    except Exception:
        return {"success": False, "message": "API Key 解密失败，可能需要重新配置"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if model.provider == "ollama":
                base_url = model.base_url or "http://host.docker.internal:11434"
                resp = await client.get(f"{base_url}/api/tags")
                resp.raise_for_status()
                return {"success": True, "message": f"Ollama 连接成功", "provider": "ollama"}

            base_url = model.base_url or "https://api.openai.com/v1"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

            if model.model_type == "embedding":
                resp = await client.post(
                    f"{base_url}/embeddings",
                    headers=headers,
                    json={"input": ["test"], "model": model.model_name}
                )
                resp.raise_for_status()
                return {"success": True, "message": f"Embedding 模型 {model.model_name} 测试成功"}

            elif model.model_type == "chat":
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": model.model_name,
                        "messages": [{"role": "user", "content": "Hi"}],
                        "max_tokens": 5
                    }
                )
                resp.raise_for_status()
                return {"success": True, "message": f"Chat 模型 {model.model_name} 测试成功"}

            elif model.model_type == "rerank":
                rerank_url = model.base_url or "https://api.cohere.ai/v1"
                resp = await client.post(
                    f"{rerank_url}/rerank",
                    headers=headers,
                    json={
                        "model": model.model_name,
                        "query": "test",
                        "documents": ["doc1"],
                        "top_n": 1
                    }
                )
                resp.raise_for_status()
                return {"success": True, "message": f"Rerank 模型 {model.model_name} 测试成功"}

            return {"success": True, "message": f"模型 {model.name} 配置有效"}

    except httpx.HTTPStatusError as e:
        return {"success": False, "message": f"API 返回错误 ({e.response.status_code}): {e.response.text[:200]}"}
    except httpx.ConnectError:
        return {"success": False, "message": f"无法连接到 {model.base_url or '默认地址'}"}
    except Exception as e:
        return {"success": False, "message": f"测试失败: {str(e)[:200]}"}


@app.post("/models/test-ollama-connection")
async def test_ollama_connection(request: dict):
    """Test Ollama connection and return available models."""
    base_url = request.get("base_url", "http://host.docker.internal:11434").rstrip("/")
    model_type = request.get("model_type", "chat")

    try:
        all_models = []
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try /api/tags first (native Ollama API)
            try:
                resp = await client.get(f"{base_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("models", []):
                    all_models.append({
                        "name": m.get("name") or m.get("model", ""),
                        "size": m.get("size", 0),
                        "modified_at": m.get("modified_at", ""),
                    })
            except Exception:
                pass

            # Fallback: /v1/models (OpenAI-compatible)
            if not all_models:
                try:
                    resp = await client.get(f"{base_url}/v1/models")
                    resp.raise_for_status()
                    data = resp.json()
                    for m in data.get("data", []):
                        all_models.append({
                            "name": m.get("id", ""),
                            "size": 0,
                            "modified_at": "",
                        })
                except Exception:
                    pass

        if not all_models:
            return {
                "success": True,
                "message": f"已连接 Ollama，但未发现模型，请确认 Ollama 已拉取模型",
                "models": [],
                "base_url": base_url,
            }

        embed_keywords = ["embed", "embedding"]
        rerank_keywords = ["rerank", "ranker"]
        vision_keywords = ["vision", "vl", "llava", "bakllava", "moondream", "minicpm-v"]
        document_keywords = ["reader", "document", "ocr", "pdf"]

        type_labels = {"chat": "对话", "vision": "视觉", "document": "文档分析", "embedding": "向量", "rerank": "重排序"}

        filtered_models = []
        for m in all_models:
            name_lower = m["name"].lower()
            is_embed = any(kw in name_lower for kw in embed_keywords)
            is_rerank = any(kw in name_lower for kw in rerank_keywords)
            is_vision = any(kw in name_lower for kw in vision_keywords)
            is_document = any(kw in name_lower for kw in document_keywords)

            if model_type == "embedding" and is_embed:
                filtered_models.append(m)
            elif model_type == "rerank" and is_rerank:
                filtered_models.append(m)
            elif model_type == "vision" and is_vision:
                filtered_models.append(m)
            elif model_type == "document" and is_document:
                filtered_models.append(m)
            elif model_type == "chat" and not is_embed and not is_rerank:
                filtered_models.append(m)

        label = type_labels.get(model_type, model_type)
        if filtered_models:
            msg = f"成功连接到 Ollama，发现 {len(filtered_models)} 个{label}模型"
        else:
            msg = f"已连接 Ollama（共 {len(all_models)} 个模型），未自动识别到{label}模型，可手动输入模型名称"

        return {
            "success": True,
            "message": msg,
            "models": filtered_models,
            "all_models": all_models,
            "base_url": base_url,
        }
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail=f"无法连接到 Ollama 服务 ({base_url})")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="连接 Ollama 超时")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"测试连接失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
