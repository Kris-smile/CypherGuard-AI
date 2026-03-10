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


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


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
    refresh_token: Optional[str] = None
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
    knowledge_base_id: Optional[UUID] = None
    title: str
    source_type: str
    source_uri: str
    mime_type: Optional[str]
    status: str
    tags: Optional[List[str]]
    version: int
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Knowledge base schemas
class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    tags: Optional[List[str]] = None
    kb_type: str = Field(..., pattern="^(document|faq)$")


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    tags: Optional[List[str]] = None


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    tags: Optional[List[str]] = None
    kb_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeBaseListResponse(KnowledgeBaseResponse):
    document_count: int = 0
    faq_count: int = 0


# Knowledge base search result (keyword search within a KB)
class KBSearchChunkItem(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_title: str
    snippet: str
    chunk_index: int


class KBSearchFAQItem(BaseModel):
    faq_id: UUID
    question: str
    answer: str
    snippet: str


class KBSearchResponse(BaseModel):
    chunks: List[KBSearchChunkItem] = []
    faq: List[KBSearchFAQItem] = []


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
class ModeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    system_prompt: str = Field(..., min_length=1)
    top_k: int = Field(default=20, ge=1, le=100)
    top_n: int = Field(default=6, ge=1, le=50)
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)
    require_citations: bool = True
    no_evidence_behavior: str = Field(default="refuse", pattern="^(refuse|answer_with_warning)$")
    retrieval_strategy: str = Field(default="hybrid", pattern="^(vector|bm25|hybrid)$")
    bm25_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    enable_web_search: bool = False


class ModeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    system_prompt: Optional[str] = Field(None, min_length=1)
    top_k: Optional[int] = Field(None, ge=1, le=100)
    top_n: Optional[int] = Field(None, ge=1, le=50)
    min_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    require_citations: Optional[bool] = None
    no_evidence_behavior: Optional[str] = Field(None, pattern="^(refuse|answer_with_warning)$")
    retrieval_strategy: Optional[str] = Field(None, pattern="^(vector|bm25|hybrid)$")
    bm25_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    enable_web_search: Optional[bool] = None


class ModeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    system_prompt: Optional[str] = None
    top_k: int
    top_n: int
    min_score: float
    require_citations: bool
    no_evidence_behavior: str
    retrieval_strategy: str = "hybrid"
    bm25_weight: float = 0.3
    enable_web_search: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# URL Import schema
class URLImportRequest(BaseModel):
    url: str = Field(..., min_length=1)
    title: Optional[str] = None
    tags: Optional[List[str]] = None


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
    images: Optional[List[str]] = None
    model_config_id: Optional[str] = None


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations_json: Optional[List[Citation]] = None
    images_json: Optional[List[str]] = None
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
    model_type: str = Field(..., pattern="^(embedding|chat|vision|document|rerank)$")
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
    model_type: Optional[str] = Field(None, pattern="^(embedding|chat|vision|document|rerank)$")
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


# FAQ schemas
class FAQCreate(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    similar_questions: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    knowledge_base_id: Optional[UUID] = None


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    similar_questions: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_enabled: Optional[bool] = None


class FAQResponse(BaseModel):
    id: UUID
    owner_user_id: Optional[UUID]
    knowledge_base_id: Optional[UUID] = None
    question: str
    answer: str
    similar_questions: Optional[List[str]]
    tags: Optional[List[str]]
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Tag schemas
class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default=None)  # 前端未传或 null 时后端用默认 #3B82F6


class TagResponse(BaseModel):
    id: UUID
    name: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


# Chunk schemas
class ChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    chunk_index: int
    text: Optional[str]
    text_hash: Optional[str]
    page_start: Optional[int]
    page_end: Optional[int]
    section_title: Optional[str]
    chunk_type: str = "text"
    is_enabled: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class ChunkUpdate(BaseModel):
    text: Optional[str] = None
    is_enabled: Optional[bool] = None


# Entity schemas
class EntityResponse(BaseModel):
    id: UUID
    document_id: Optional[UUID]
    chunk_id: Optional[UUID]
    entity_type: str
    value: str
    count: int
    created_at: datetime

    class Config:
        from_attributes = True
