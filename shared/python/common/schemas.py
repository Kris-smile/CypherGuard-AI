"""Pydantic schemas for API requests and responses"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
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
