"""Pydantic schemas for API requests and responses"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: str  # Can be email or username
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Document schemas
class DocumentCreate(BaseModel):
    title: str
    source_type: str = Field(..., pattern="^(upload|url)$")
    source_uri: str
    mime_type: Optional[str] = None
    tags: Optional[List[str]] = None


class DocumentResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    title: str
    source_type: str
    source_uri: str
    mime_type: Optional[str]
    status: str
    tags: Optional[List[str]]
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Task schemas
class TaskResponse(BaseModel):
    id: UUID
    document_id: UUID
    task_type: str
    celery_task_id: Optional[str]
    status: str
    progress: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Mode schemas
class ModeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    top_k: int
    top_n: int
    min_score: float
    require_citations: bool
    no_evidence_behavior: str
    created_at: datetime

    class Config:
        from_attributes = True


# Conversation schemas
class ConversationCreate(BaseModel):
    mode_name: Optional[str] = "quick"
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    mode_id: UUID
    title: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Citation schema
class Citation(BaseModel):
    document_id: str
    title: str
    source_type: str
    source_uri: str
    chunk_id: str
    chunk_index: int
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    snippet: str
    score: float


# Message schemas
class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations_json: Optional[List[Citation]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Chat response with full trace
class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    mode: str
    trace: Dict[str, Any]


# Model Config schemas
class ModelConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    model_type: str = Field(..., pattern="^(embedding|chat|rerank)$")
    provider: str = Field(..., min_length=1, max_length=100)
    base_url: Optional[str] = None
    model_name: str = Field(..., min_length=1, max_length=255)
    api_key: str = Field(..., min_length=1)
    params_json: Optional[Dict[str, Any]] = None
    max_concurrency: int = Field(default=4, ge=1, le=100)
    rate_limit_rpm: Optional[int] = Field(default=None, ge=0)
    enabled: bool = True


class ModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    model_type: Optional[str] = Field(None, pattern="^(embedding|chat|rerank)$")
    provider: Optional[str] = Field(None, min_length=1, max_length=100)
    base_url: Optional[str] = None
    model_name: Optional[str] = Field(None, min_length=1, max_length=255)
    api_key: Optional[str] = Field(None, min_length=1)
    params_json: Optional[Dict[str, Any]] = None
    max_concurrency: Optional[int] = Field(None, ge=1, le=100)
    rate_limit_rpm: Optional[int] = Field(None, ge=0)
    enabled: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    id: UUID
    name: str
    model_type: str
    provider: str
    base_url: Optional[str]
    model_name: str
    is_default: bool
    params_json: Optional[Dict[str, Any]]
    max_concurrency: int
    rate_limit_rpm: Optional[int]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
