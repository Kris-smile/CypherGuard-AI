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
    similar_questions JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_faq_owner ON faq_entries(owner_user_id);

-- Normalize old TEXT[] FAQ columns to JSONB.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'faq_entries'
          AND column_name = 'similar_questions'
          AND udt_name = '_text'
    ) THEN
        ALTER TABLE faq_entries
            ALTER COLUMN similar_questions TYPE JSONB
            USING to_jsonb(COALESCE(similar_questions, ARRAY[]::TEXT[]));
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'faq_entries'
          AND column_name = 'tags'
          AND udt_name = '_text'
    ) THEN
        ALTER TABLE faq_entries
            ALTER COLUMN tags TYPE JSONB
            USING to_jsonb(COALESCE(tags, ARRAY[]::TEXT[]));
    END IF;
END $$;

ALTER TABLE faq_entries
    ALTER COLUMN similar_questions SET DEFAULT '[]'::jsonb,
    ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

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

-- 9. knowledge_bases table + kb_id on documents / faq_entries
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    kb_type VARCHAR(20) NOT NULL CHECK (kb_type IN ('document', 'faq')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_owner ON knowledge_bases(owner_user_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;
ALTER TABLE faq_entries ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_faq_entries_kb ON faq_entries(knowledge_base_id);
