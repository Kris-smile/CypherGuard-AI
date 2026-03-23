"""SQLAlchemy ORM models"""

from sqlalchemy import Column, String, Integer, Float, Boolean, Text, TIMESTAMP, ForeignKey, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR, JSONB
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


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    tags = Column(ARRAY(Text), default=[])
    kb_type = Column(String(20), nullable=False)  # 'document' | 'faq'
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    knowledge_base_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="SET NULL"))
    title = Column(String(500), nullable=False)
    source_type = Column(String(20), nullable=False)
    source_uri = Column(Text, nullable=False)
    mime_type = Column(String(100))
    status = Column(String(20), nullable=False, default="pending")
    parse_status = Column(String(20), nullable=False, default="pending")
    summary_status = Column(String(20), nullable=False, default="pending")
    tags = Column(ARRAY(Text))
    version = Column(Integer, default=1)
    summary = Column(Text)
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
    chunk_type = Column(String(20), default="text")
    parent_chunk_id = Column(UUID(as_uuid=True), ForeignKey("chunks.id"))
    is_enabled = Column(Boolean, default=True)
    tsv = Column(TSVECTOR)
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


class Mode(Base):
    __tablename__ = "modes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    system_prompt = Column(Text, nullable=False)
    top_k = Column(Integer, default=20)
    top_n = Column(Integer, default=6)
    min_score = Column(Float, default=0.0)
    require_citations = Column(Boolean, default=True)
    no_evidence_behavior = Column(String(30), nullable=False, default="refuse")
    retrieval_strategy = Column(String(20), default="hybrid")
    bm25_weight = Column(Float, default=0.3)
    enable_web_search = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mode_id = Column(UUID(as_uuid=True), ForeignKey("modes.id"), nullable=False)
    title = Column(Text)
    context_config = Column(JSON, default={"strategy": "sliding_window", "window_size": 10})
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    citations_json = Column(JSON)
    agent_steps = Column(JSON)
    images_json = Column(JSON)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class FAQEntry(Base):
    __tablename__ = "faq_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    knowledge_base_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="SET NULL"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    similar_questions = Column(JSONB, default=list)
    tags = Column(JSONB, default=list)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    color = Column(String(7), default="#3B82F6")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("chunks.id", ondelete="CASCADE"))
    entity_type = Column(String(20), nullable=False)
    value = Column(Text, nullable=False)
    count = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
