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
    model_gateway_max_concurrency_embedding: int = 4
    model_gateway_max_concurrency_chat: int = 4
    model_gateway_max_concurrency_rerank: int = 4
    model_gateway_rate_limit_rpm_embedding: int = 120
    model_gateway_rate_limit_rpm_chat: int = 60
    model_gateway_rate_limit_rpm_rerank: int = 120
    model_gateway_timeout_seconds_embedding: int = 60
    model_gateway_timeout_seconds_chat: int = 120
    model_gateway_timeout_seconds_rerank: int = 30
    model_gateway_acquire_timeout_seconds: float = 0.05

    # Upload limits
    upload_max_mb: int = 100
    url_fetch_max_mb: int = 50
    url_fetch_timeout_seconds: int = 30

    # API Key encryption (Fernet symmetric key, 32-byte base64-encoded)
    api_key_encryption_secret: str = "dGhpcy1pcy1hLXRlc3Qta2V5LWNoYW5nZS1pdC0xMjM="

    # SSRF protection
    ssrf_blocked_cidrs: str = "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,::1/128"
    url_fetch_allowed_schemes: str = "http,https"
    url_fetch_max_redirects: int = 5

    # Timeouts
    request_timeout_seconds: int = 300
    embedding_timeout_seconds: int = 60
