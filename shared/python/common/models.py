"""SQLAlchemy ORM models"""

from sqlalchemy import Column, String, Integer, Float, Boolean, Text, TIMESTAMP, ForeignKey, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    source_type = Column(String(20), nullable=False)
    source_uri = Column(Text, nullable=False)
    mime_type = Column(String(100))
    status = Column(String(20), nullable=False, default="pending")
    tags = Column(ARRAY(Text))
    version = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text)
    text_hash = Column(String(64))
    page_start = Column(Integer)
    page_end = Column(Integer)
    section_title = Column(Text)
    source_offset_start = Column(Integer)
    source_offset_end = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IngestionTask(Base):
    __tablename__ = "ingestion_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    task_type = Column(String(20), nullable=False)
    celery_task_id = Column(String(255))
    status = Column(String(20), nullable=False, default="pending")
    progress = Column(Integer, default=0)
    error_message = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    model_type = Column(String(20), nullable=False)
    provider = Column(String(100), nullable=False)
    base_url = Column(Text)
    model_name = Column(String(255), nullable=False)
    api_key_encrypted = Column(Text)
    is_default = Column(Boolean, default=False)
    params_json = Column(JSON)
    max_concurrency = Column(Integer, default=4)
    rate_limit_rpm = Column(Integer)
    enabled = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
