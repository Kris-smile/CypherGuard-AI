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
    chunk_type VARCHAR(20) DEFAULT 'text',
    parent_chunk_id UUID REFERENCES chunks(id),
    is_enabled BOOLEAN DEFAULT TRUE,
    tsv TSVECTOR,
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
    retrieval_strategy VARCHAR(20) DEFAULT 'hybrid' CHECK (retrieval_strategy IN ('vector', 'bm25', 'hybrid')),
    bm25_weight FLOAT DEFAULT 0.3,
    enable_web_search BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode_id UUID NOT NULL REFERENCES modes(id),
    title TEXT,
    context_config JSONB DEFAULT '{"strategy":"sliding_window","window_size":10}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations_json JSONB,
    agent_steps JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents summary column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;

-- FAQ entries table
CREATE TABLE IF NOT EXISTS faq_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    similar_questions TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Entities table (cybersecurity entity extraction)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    meta_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(text_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_enabled ON chunks(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ingestion_tasks_document ON ingestion_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_tasks_status ON ingestion_tasks(status);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_faq_entries_owner ON faq_entries(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_entities_type_value ON entities(entity_type, value);
CREATE INDEX IF NOT EXISTS idx_entities_document ON entities(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Auto-update tsvector on chunk insert/update
CREATE OR REPLACE FUNCTION chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.tsv := to_tsvector('english', COALESCE(NEW.text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_chunks_tsv ON chunks;
CREATE TRIGGER trig_chunks_tsv
    BEFORE INSERT OR UPDATE OF text ON chunks
    FOR EACH ROW EXECUTE FUNCTION chunks_tsv_trigger();

-- Insert default modes
INSERT INTO modes (name, description, system_prompt, top_k, top_n, min_score, require_citations, no_evidence_behavior, retrieval_strategy, bm25_weight)
VALUES
    ('quick', '快速模式', '你是一个有用的AI助手。根据提供的上下文回答问题。简洁直接。', 10, 3, 0.0, FALSE, 'answer_with_warning', 'hybrid', 0.3),
    ('strict', '严谨模式', '你是一个严谨的AI助手。只有在知识库中有明确证据时才回答问题。始终引用来源。', 20, 6, 0.3, TRUE, 'refuse', 'hybrid', 0.4)
ON CONFLICT (name) DO NOTHING;

-- Create a default admin user (password: admin123 - CHANGE IN PRODUCTION)
-- Password hash for 'admin123' using argon2id
INSERT INTO users (email, username, password_hash, role)
VALUES ('admin@cypherguard.local', 'admin', '$argon2id$v=19$m=65536,t=3,p=4$vfc+55yzNiZE6F0LYcz53w$4rLeQcL/zK2Cm6kwqNXAE93YUnXCVGBi4MwK5N7Op4I', 'admin')
ON CONFLICT (email) DO NOTHING;

