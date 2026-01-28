-- CypherGuard AI Database Initialization Script
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('upload', 'url')),
    source_uri TEXT NOT NULL,
    mime_type VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'deleted')),
    tags TEXT[],
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT,
    text_hash VARCHAR(64),
    page_start INTEGER,
    page_end INTEGER,
    section_title TEXT,
    source_offset_start INTEGER,
    source_offset_end INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, chunk_index)
);

-- Ingestion tasks table
CREATE TABLE IF NOT EXISTS ingestion_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('fetch_url', 'parse', 'chunk', 'embed', 'index')),
    celery_task_id VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Model configurations table
CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    model_type VARCHAR(20) NOT NULL CHECK (model_type IN ('chat', 'embedding', 'rerank', 'vision', 'doc_parse')),
    provider VARCHAR(100) NOT NULL,
    base_url TEXT,
    model_name VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    params_json JSONB,
    max_concurrency INTEGER DEFAULT 4,
    rate_limit_rpm INTEGER,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Modes table
CREATE TABLE IF NOT EXISTS modes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,
    top_k INTEGER DEFAULT 20,
    top_n INTEGER DEFAULT 6,
    min_score FLOAT DEFAULT 0.0,
    require_citations BOOLEAN DEFAULT TRUE,
    no_evidence_behavior VARCHAR(30) NOT NULL CHECK (no_evidence_behavior IN ('refuse', 'answer_with_warning')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode_id UUID NOT NULL REFERENCES modes(id),
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table (optional for MVP)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    meta_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(text_hash);
CREATE INDEX IF NOT EXISTS idx_ingestion_tasks_document ON ingestion_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_tasks_status ON ingestion_tasks(status);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Insert default modes
INSERT INTO modes (name, description, system_prompt, top_k, top_n, min_score, require_citations, no_evidence_behavior)
VALUES
    ('quick', 'Quick mode for fast responses', 'You are a helpful AI assistant. Answer questions based on the provided context. Be concise and direct.', 10, 3, 0.0, FALSE, 'answer_with_warning'),
    ('strict', 'Strict mode requiring evidence', 'You are a rigorous AI assistant. Only answer questions when you have clear evidence from the knowledge base. Always cite your sources.', 20, 6, 0.3, TRUE, 'refuse')
ON CONFLICT (name) DO NOTHING;

-- Create a default admin user (password: admin123 - CHANGE IN PRODUCTION)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, username, password_hash, role)
VALUES ('admin@cypherguard.local', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEMule', 'admin')
ON CONFLICT (email) DO NOTHING;

