-- Migration: add new columns and tables for M1-M12 features

-- 1. chunks table
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS tsv TSVECTOR;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS chunk_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES chunks(id);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING GIN(tsv);

CREATE OR REPLACE FUNCTION chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.tsv := to_tsvector('english', COALESCE(NEW.text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_chunks_tsv ON chunks;
CREATE TRIGGER trig_chunks_tsv BEFORE INSERT OR UPDATE OF text ON chunks FOR EACH ROW EXECUTE FUNCTION chunks_tsv_trigger();

UPDATE chunks SET tsv = to_tsvector('english', COALESCE(text, '')) WHERE tsv IS NULL;

-- 2. modes table
ALTER TABLE modes ADD COLUMN IF NOT EXISTS retrieval_strategy VARCHAR(20) DEFAULT 'hybrid';
ALTER TABLE modes ADD COLUMN IF NOT EXISTS bm25_weight FLOAT DEFAULT 0.3;
ALTER TABLE modes ADD COLUMN IF NOT EXISTS enable_web_search BOOLEAN DEFAULT FALSE;

-- 3. conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context_config JSONB DEFAULT '{"strategy":"sliding_window","window_size":10}';

-- 4. messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_steps JSONB;

-- 5. documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;

-- 6. faq_entries table
CREATE TABLE IF NOT EXISTS faq_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    similar_questions JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_faq_owner ON faq_entries(owner_user_id);

-- 7. tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#6B7280',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entities_document ON entities(document_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
