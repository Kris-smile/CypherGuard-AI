# CypherGuard AI Architecture

## Overview
CypherGuard AI is a microservice-based RAG system for managing security knowledge, ingesting documents, and answering questions with citations. The MVP runs fully on local infrastructure with Docker Compose and uses a model gateway for online/offline model backends.

## Core Services
- gateway (Nginx): reverse proxy, basic routing, optional CORS/rate limit
- auth-service: registration/login/JWT + RBAC (admin/user)
- kb-service: document metadata, file upload, ingestion task tracking
- chat-service: vector search, rerank, chat completion, citations
- model-gateway: unified model access + concurrency + rate limiting
- worker: ingestion pipeline (parse/chunk/embed/index)

## Infrastructure
- PostgreSQL: relational metadata (users, documents, chunks, modes, conversations)
- Redis: Celery broker/backend, rate limiting counters
- MinIO: object storage for uploads and HTML snapshots
- Qdrant: vector database for chunk embeddings

## Data Flow

### Upload Ingestion
1. User uploads a file to kb-service.
2. kb-service stores the file in MinIO and creates a `documents` record.
3. kb-service enqueues `worker.process_document` via Celery.
4. worker downloads from MinIO, extracts text, chunks, embeds, and indexes into Qdrant.
5. worker updates ingestion task and document status.

### Chat Query
1. chat-service embeds the user query via model-gateway.
2. chat-service searches Qdrant for TopK chunks.
3. chat-service reranks and selects TopN.
4. chat-service calls model-gateway for chat response with context.
5. chat-service returns answer + citations + trace.

## Concurrency and Rate Limits
- model-gateway enforces per-endpoint concurrency with semaphores.
- Redis token bucket limits RPM per endpoint or model config ID.
- When busy or over limit, model-gateway returns HTTP 429.

## Security Notes
- JWT secret is loaded from environment variables.
- Passwords are hashed with bcrypt/argon2.
- Sensitive values (API keys) must not be logged.

## Observability
- All services expose `/healthz`.
- model-gateway logs request latency and status.
- chat-service returns trace timing in responses.
