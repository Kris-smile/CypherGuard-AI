# CypherGuard AI API (MVP)

Base URL (via gateway): `http://localhost`

## Auth Service

### POST /auth/register
Request:
```json
{
  "email": "user@example.com",
  "username": "user1",
  "password": "secret123"
}
```
Response:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "user1",
    "role": "user",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

### POST /auth/login
Request:
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

### GET /auth/me
Header: `Authorization: Bearer <token>`

## KB Service

### POST /kb/documents/upload
Multipart form:
- `file` (required)
- `title` (optional)
- `tags` (optional, comma-separated)

Response: `DocumentResponse`

### GET /kb/documents
Query params: `skip`, `limit`

### GET /kb/documents/{id}

### DELETE /kb/documents/{id}

### GET /kb/tasks
Query params: `document_id` (optional)

## Chat Service

### GET /chat/modes

### POST /chat/conversations
Request:
```json
{
  "mode_name": "quick",
  "title": "optional title"
}
```

### GET /chat/conversations
Query params: `skip`, `limit`

### GET /chat/conversations/{id}/messages

### POST /chat/conversations/{id}/messages
Request:
```json
{
  "content": "What does this document say about X?"
}
```
Response:
```json
{
  "answer": "...",
  "citations": [
    {
      "document_id": "uuid",
      "title": "doc.pdf",
      "source_type": "upload",
      "source_uri": "s3://...",
      "chunk_id": "uuid",
      "chunk_index": 0,
      "page_start": 1,
      "page_end": 2,
      "snippet": "...",
      "score": 0.87
    }
  ],
  "mode": "strict",
  "trace": {
    "top_k": 20,
    "top_n": 6,
    "latency_ms": {
      "embed": 50,
      "search": 30,
      "rerank": 80,
      "llm": 900,
      "total": 1100
    }
  }
}
```

## Model Gateway (Internal)

### POST /internal/embeddings
Request:
```json
{
  "texts": ["hello"],
  "model": "optional",
  "model_config_id": "optional"
}
```

### POST /internal/chat
Request:
```json
{
  "messages": [{"role": "user", "content": "hi"}],
  "model": "optional",
  "model_config_id": "optional"
}
```

### POST /internal/rerank
Request:
```json
{
  "query": "...",
  "documents": ["doc1", "doc2"],
  "top_n": 5,
  "model": "optional",
  "model_config_id": "optional"
}
```

## Health
All services expose:
- `GET /healthz`
