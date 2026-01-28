"""Configuration management using pydantic-settings"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Base settings for all services"""

    # Database
    postgres_url: str = "postgresql://postgres:postgres@postgres:5432/cypherguard"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    jwt_secret: str = "change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # MinIO
    minio_endpoint: Optional[str] = "minio:9000"
    minio_access_key: Optional[str] = "minioadmin"
    minio_secret_key: Optional[str] = "minioadmin"
    minio_bucket: Optional[str] = "cypherguard-kb"
    minio_secure: bool = False

    # Qdrant
    qdrant_url: Optional[str] = "http://qdrant:6333"

    # Model Gateway
    model_gateway_url: Optional[str] = "http://model-gateway:8000"

    # Upload limits
    upload_max_mb: int = 100
    url_fetch_max_mb: int = 50
    url_fetch_timeout_seconds: int = 30

    # Timeouts
    request_timeout_seconds: int = 300
    embedding_timeout_seconds: int = 60
