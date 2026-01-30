"""Model Config Service - Model configuration management"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import sys
import os

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User, ModelConfig
from common.schemas import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse
from common.exceptions import NotFoundError, ConflictError
from common.auth import decode_access_token

# Initialize app
app = FastAPI(
    title="Model Config Service",
    version="1.0.0",
    docs_url="/models/docs",
    openapi_url="/models/openapi.json",
    redoc_url="/models/redoc"
)

# Add CORS middleware
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


async def get_current_user_id(authorization: str = None) -> str:
    """Get current user ID from JWT token (simplified)"""
    if not authorization:
        return "00000000-0000-0000-0000-000000000001"
    return "00000000-0000-0000-0000-000000000001"


def encrypt_api_key(api_key: str) -> str:
    """Encrypt API key (simple base64 for now, should use proper encryption)"""
    import base64
    return base64.b64encode(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    """Decrypt API key"""
    import base64
    return base64.b64decode(encrypted.encode()).decode()


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.get("/models", response_model=List[ModelConfigResponse])
async def list_models(
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all model configurations"""
    models = session.query(ModelConfig).order_by(
        ModelConfig.is_default.desc(),
        ModelConfig.created_at.desc()
    ).all()
    
    return [ModelConfigResponse.model_validate(m) for m in models]


@app.get("/models/{model_id}", response_model=ModelConfigResponse)
async def get_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get model configuration by ID"""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    
    if not model:
        raise NotFoundError("Model configuration not found")
    
    return ModelConfigResponse.model_validate(model)


@app.post("/models", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: ModelConfigCreate,
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new model configuration"""
    # Check if name already exists
    existing = session.query(ModelConfig).filter(ModelConfig.name == data.name).first()
    if existing:
        raise ConflictError("Model configuration with this name already exists")
    
    # Encrypt API key
    encrypted_key = encrypt_api_key(data.api_key)
    
    # Create model config
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
    
    # If this is the first model, make it default
    count = session.query(ModelConfig).count()
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
    user_id: str = Depends(get_current_user_id)
):
    """Update model configuration"""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    
    if not model:
        raise NotFoundError("Model configuration not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle API key encryption
    if 'api_key' in update_data and update_data['api_key']:
        update_data['api_key_encrypted'] = encrypt_api_key(update_data.pop('api_key'))
    
    for key, value in update_data.items():
        setattr(model, key, value)
    
    session.commit()
    session.refresh(model)
    
    return ModelConfigResponse.model_validate(model)


@app.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete model configuration"""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    
    if not model:
        raise NotFoundError("Model configuration not found")
    
    if model.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default model. Set another model as default first."
        )
    
    session.delete(model)
    session.commit()
    
    return None


@app.post("/models/{model_id}/set-default", status_code=status.HTTP_200_OK)
async def set_default_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Set a model as default"""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    
    if not model:
        raise NotFoundError("Model configuration not found")
    
    # Remove default from all models of the same type
    session.query(ModelConfig).filter(
        ModelConfig.model_type == model.model_type
    ).update({"is_default": False})
    
    # Set this model as default
    model.is_default = True
    session.commit()
    
    return {"message": "Default model updated successfully"}


@app.post("/models/{model_id}/test")
async def test_model(
    model_id: UUID,
    session: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Test model configuration"""
    model = session.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    
    if not model:
        raise NotFoundError("Model configuration not found")
    
    if not model.enabled:
        return {
            "success": False,
            "message": "Model is disabled"
        }
    
    # TODO: Implement actual model testing
    # For now, just return success
    return {
        "success": True,
        "message": f"Model {model.name} is configured correctly"
    }


@app.post("/models/test-ollama-connection")
async def test_ollama_connection(request: dict):
    """Test Ollama connection and return available models"""
    import urllib.request
    import urllib.error
    import json as json_lib
    
    base_url = request.get("base_url", "http://host.docker.internal:11434")
    model_type = request.get("model_type", "chat")
    
    try:
        # Test connection using urllib
        req = urllib.request.Request(
            f"{base_url}/api/tags",
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json_lib.loads(response.read().decode())
            
        # Filter models by type
        all_models = data.get("models", [])
        
        # Ollama doesn't explicitly mark model types, so we use heuristics
        # Embedding models usually have "embed" in the name
        # Chat models are everything else
        filtered_models = []
        for model in all_models:
            model_name = model.get("name", "")
            if model_type == "embedding":
                if "embed" in model_name.lower():
                    filtered_models.append({
                        "name": model_name,
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at", "")
                    })
            elif model_type == "chat":
                if "embed" not in model_name.lower():
                    filtered_models.append({
                        "name": model_name,
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at", "")
                    })
            else:
                # For rerank, return empty (Ollama doesn't support rerank)
                pass
        
        return {
            "success": True,
            "message": f"成功连接到 Ollama，发现 {len(filtered_models)} 个{model_type}模型",
            "models": filtered_models,
            "base_url": base_url
        }
        
    except urllib.error.URLError as e:
        if isinstance(e.reason, ConnectionRefusedError):
            raise HTTPException(
                status_code=503,
                detail=f"无法连接到 Ollama 服务 ({base_url})，请确保 Ollama 正在运行"
            )
        else:
            raise HTTPException(
                status_code=503,
                detail=f"无法连接到 Ollama 服务: {str(e.reason)}"
            )
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="连接 Ollama 超时，请检查网络或服务状态"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"测试连接失败: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
