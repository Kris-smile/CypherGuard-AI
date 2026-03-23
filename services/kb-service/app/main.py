"""KB Service - Knowledge base document management"""

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status, Form, Header, Query
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from minio import Minio
from minio.error import S3Error
from celery import Celery
from typing import List, Optional
from uuid import UUID
import sys
import os
import ipaddress
import logging
from urllib.parse import urlparse
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from sqlalchemy import text as sql_text
from sqlalchemy import func

from common.models import User, Document, IngestionTask, Chunk, FAQEntry, Tag, Entity, KnowledgeBase
from common.schemas import (
    DocumentBatchRequest, DocumentResponse, TaskResponse, URLImportRequest,
    FAQCreate, FAQUpdate, FAQResponse,
    TagCreate, TagResponse,
    ChunkResponse, ChunkUpdate,
    EntityResponse,
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse, KnowledgeBaseListResponse,
    KBSearchResponse, KBSearchChunkItem, KBSearchFAQItem,
)
from common.auth import decode_token_payload, TokenPayload
from common.exceptions import NotFoundError, AuthenticationError, AuthorizationError, ValidationError
from common.document_status import normalize_document_status, queue_document_processing

logger = logging.getLogger(__name__)

app = FastAPI(
    title="KB Service",
    version="2.0.0",
    docs_url="/kb/docs",
    openapi_url="/kb/openapi.json",
    redoc_url="/kb/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = Settings()
db = Database(settings.postgres_url)

minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure
)

celery_app = Celery("kb-service", broker=settings.redis_url, backend=settings.redis_url)


def get_db():
    return next(db.get_session())


async def get_current_user(authorization: Optional[str] = Header(None)) -> TokenPayload:
    """Extract and validate JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("缺少认证令牌")
    token = authorization[7:]
    payload = decode_token_payload(token, settings.jwt_secret, settings.jwt_algorithm)
    if payload is None:
        raise AuthenticationError("令牌无效或已过期")
    return payload


async def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """Require admin role."""
    if user.role != "admin":
        raise AuthorizationError("需要管理员权限")
    return user


# --------------- SSRF Protection ---------------

def validate_url_for_import(url: str) -> str:
    """Validate URL against SSRF attacks."""
    parsed = urlparse(url)

    allowed_schemes = [s.strip() for s in settings.url_fetch_allowed_schemes.split(",")]
    if parsed.scheme not in allowed_schemes:
        raise ValidationError(f"不允许的协议: {parsed.scheme}，仅允许 {', '.join(allowed_schemes)}")

    if not parsed.hostname:
        raise ValidationError("无效的URL: 缺少主机名")

    blocked_cidrs = [s.strip() for s in settings.ssrf_blocked_cidrs.split(",") if s.strip()]

    import socket
    try:
        resolved_ips = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise ValidationError(f"无法解析域名: {parsed.hostname}")

    for _, _, _, _, sockaddr in resolved_ips:
        ip = ipaddress.ip_address(sockaddr[0])
        for cidr in blocked_cidrs:
            if ip in ipaddress.ip_network(cidr, strict=False):
                raise ValidationError(f"禁止访问内网地址: {parsed.hostname}")

    return url


@app.on_event("startup")
async def startup_event():
    try:
        if not minio_client.bucket_exists(settings.minio_bucket):
            minio_client.make_bucket(settings.minio_bucket)
            logger.info(f"Created MinIO bucket: {settings.minio_bucket}")
    except S3Error as e:
        logger.error(f"MinIO error: {e}")


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    return "OK"


# ============== Knowledge Base CRUD ==============

@app.post("/kb/knowledge-bases", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    data: KnowledgeBaseCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Create a new knowledge base (document or FAQ type)."""
    kb = KnowledgeBase(
        owner_user_id=user.sub,
        name=data.name,
        tags=data.tags or [],
        kb_type=data.kb_type,
    )
    session.add(kb)
    session.commit()
    session.refresh(kb)
    return KnowledgeBaseResponse.model_validate(kb)


@app.get("/kb/knowledge-bases", response_model=List[KnowledgeBaseListResponse])
async def list_knowledge_bases(
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List knowledge bases with document/FAQ counts."""
    kbs = session.query(KnowledgeBase).filter(
        KnowledgeBase.owner_user_id == user.sub
    ).order_by(KnowledgeBase.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for kb in kbs:
        doc_count = session.query(func.count(Document.id)).filter(
            Document.knowledge_base_id == kb.id,
            Document.status != "deleted",
        ).scalar() or 0
        faq_count = session.query(func.count(FAQEntry.id)).filter(
            FAQEntry.knowledge_base_id == kb.id,
        ).scalar() or 0
        result.append(KnowledgeBaseListResponse(
            **KnowledgeBaseResponse.model_validate(kb).model_dump(),
            document_count=doc_count,
            faq_count=faq_count,
        ))
    return result


@app.get("/kb/knowledge-bases/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    kb = session.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.owner_user_id == user.sub,
    ).first()
    if not kb:
        raise NotFoundError("知识库未找到")
    return KnowledgeBaseResponse.model_validate(kb)


@app.put("/kb/knowledge-bases/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: UUID,
    data: KnowledgeBaseUpdate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    kb = session.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.owner_user_id == user.sub,
    ).first()
    if not kb:
        raise NotFoundError("知识库未找到")
    if data.name is not None:
        kb.name = data.name
    if data.tags is not None:
        kb.tags = data.tags
    session.commit()
    session.refresh(kb)
    return KnowledgeBaseResponse.model_validate(kb)


@app.delete("/kb/knowledge-bases/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    kb = session.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.owner_user_id == user.sub,
    ).first()
    if not kb:
        raise NotFoundError("知识库未找到")
    session.delete(kb)
    session.commit()
    return None


@app.get("/kb/knowledge-bases/{kb_id}/search", response_model=KBSearchResponse)
async def search_knowledge_base(
    kb_id: UUID,
    q: str,
    limit: int = 20,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Keyword search within a knowledge base (chunks for document-type, FAQ for faq-type)."""
    kb = session.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.owner_user_id == user.sub,
    ).first()
    if not kb:
        raise NotFoundError("知识库未找到")

    chunks_out: List[KBSearchChunkItem] = []
    faq_out: List[KBSearchFAQItem] = []

    query = (q or "").strip()
    if not query:
        return KBSearchResponse(chunks=chunks_out, faq=faq_out)

    if kb.kb_type == "document":
        try:
            sql = sql_text("""
                SELECT c.id, c.document_id, c.chunk_index, c.text, d.title
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE d.knowledge_base_id = :kb_id
                  AND d.status = 'ready'
                  AND c.is_enabled = true
                  AND c.tsv @@ plainto_tsquery('english', :query)
                ORDER BY ts_rank(c.tsv, plainto_tsquery('english', :query)) DESC
                LIMIT :lim
            """)
            rows = session.execute(sql, {"kb_id": kb_id, "query": query, "lim": limit}).fetchall()
            for row in rows:
                text = (row.text or "")[:500]
                chunks_out.append(KBSearchChunkItem(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_title=row.title or "",
                    snippet=text + ("..." if len(row.text or "") > 500 else ""),
                    chunk_index=row.chunk_index,
                ))
        except Exception as e:
            logger.warning(f"KB chunk search error: {e}")

    elif kb.kb_type == "faq":
        pattern = f"%{query}%"
        faq_rows = session.query(FAQEntry).filter(
            FAQEntry.knowledge_base_id == kb_id,
            (FAQEntry.question.ilike(pattern)) | (FAQEntry.answer.ilike(pattern)),
        ).limit(limit).all()
        for faq in faq_rows:
            snippet = faq.question if query.lower() in (faq.question or "").lower() else (faq.answer or "")[:300]
            faq_out.append(KBSearchFAQItem(
                faq_id=faq.id,
                question=faq.question or "",
                answer=faq.answer or "",
                snippet=snippet + ("..." if len(faq.answer or "") > 300 else ""),
            ))

    return KBSearchResponse(chunks=chunks_out, faq=faq_out)


# ============== Documents ==============

@app.post("/kb/documents/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    knowledge_base_id: Optional[str] = Form(None),
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Upload a document file."""
    user_id = user.sub
    doc_title = title or file.filename
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()] or None
    kb_id = None
    if knowledge_base_id and knowledge_base_id.strip():
        try:
            kb_id = UUID(knowledge_base_id)
        except (ValueError, TypeError):
            kb_id = None

    # Check file size
    file_content = await file.read()
    max_bytes = settings.upload_max_mb * 1024 * 1024
    if len(file_content) > max_bytes:
        raise ValidationError(f"文件大小超过限制 ({settings.upload_max_mb}MB)")

    # Check file extension (primary validation)
    allowed_extensions = {
        ".md", ".pdf", ".html", ".htm", ".txt",
        ".docx", ".xlsx", ".csv", ".pptx",
    }
    filename = file.filename or ""
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise ValidationError(
            f"不支持的文件格式「{file_ext}」，仅允许：{', '.join(sorted(allowed_extensions))}"
        )

    # Check MIME type (secondary validation)
    allowed_types = [
        "application/pdf", "text/plain", "text/markdown",
        "text/html", "application/xhtml+xml",
        "application/octet-stream",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",
    ]
    if file.content_type and file.content_type not in allowed_types:
        raise ValidationError(f"不支持的文件类型: {file.content_type}")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    object_name = f"{user_id}/{timestamp}_{file.filename}"

    try:
        from io import BytesIO
        minio_client.put_object(
            settings.minio_bucket,
            object_name,
            data=BytesIO(file_content),
            length=len(file_content),
            content_type=file.content_type or "application/octet-stream"
        )

        document = Document(
            owner_user_id=user_id,
            knowledge_base_id=kb_id,
            title=doc_title,
            source_type="upload",
            source_uri=f"s3://{settings.minio_bucket}/{object_name}",
            mime_type=file.content_type,
            tags=tag_list
        )
        queue_document_processing(document)
        session.add(document)
        session.commit()
        session.refresh(document)

        task = celery_app.send_task("worker.process_document", args=[str(document.id)], queue="celery")

        ingestion_task = IngestionTask(
            document_id=document.id,
            task_type="parse",
            celery_task_id=task.id,
            status="pending"
        )
        session.add(ingestion_task)
        session.commit()
        session.refresh(document)

        return DocumentResponse.model_validate(normalize_document_status(document))

    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"创建文档失败: {str(e)}")


@app.post("/kb/documents/import-url", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def import_url(
    request: URLImportRequest,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Import a document from a public URL with SSRF protection."""
    user_id = user.sub

    validated_url = validate_url_for_import(request.url)

    doc_title = request.title or validated_url
    document = Document(
        owner_user_id=user_id,
        knowledge_base_id=request.knowledge_base_id,
        title=doc_title,
        source_type="url",
        source_uri=validated_url,
        mime_type="text/html",
        tags=request.tags
    )
    queue_document_processing(document)
    session.add(document)
    session.commit()
    session.refresh(document)

    task = celery_app.send_task("worker.fetch_and_process_url", args=[str(document.id)], queue="celery")

    ingestion_task = IngestionTask(
        document_id=document.id,
        task_type="fetch_url",
        celery_task_id=task.id,
        status="pending"
    )
    session.add(ingestion_task)
    session.commit()

    return DocumentResponse.model_validate(normalize_document_status(document))


@app.get("/kb/documents", response_model=List[DocumentResponse])
async def list_documents(
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    knowledge_base_id: Optional[UUID] = None,
):
    q = session.query(Document).filter(
        Document.owner_user_id == user.sub,
        Document.status != "deleted"
    )
    if knowledge_base_id is not None:
        q = q.filter(Document.knowledge_base_id == knowledge_base_id)
    documents = q.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    return [DocumentResponse.model_validate(normalize_document_status(doc)) for doc in documents]


@app.post("/kb/documents/batch", response_model=List[DocumentResponse])
async def batch_get_documents(
    request: DocumentBatchRequest,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Fetch a batch of documents for polling status updates."""
    if not request.ids:
        return []

    documents = session.query(Document).filter(
        Document.owner_user_id == user.sub,
        Document.id.in_(request.ids),
        Document.status != "deleted"
    ).all()
    return [DocumentResponse.model_validate(normalize_document_status(doc)) for doc in documents]


@app.get("/kb/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user.sub
    ).first()
    if not document:
        raise NotFoundError("文档未找到")
    return DocumentResponse.model_validate(normalize_document_status(document))


@app.delete("/kb/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user.sub
    ).first()
    if not document:
        raise NotFoundError("文档未找到")
    document.status = "deleted"
    session.commit()
    return None


@app.post("/kb/documents/{document_id}/reindex", response_model=DocumentResponse)
async def reindex_document(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Re-index an existing document (re-parse, re-chunk, re-embed)."""
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user.sub
    ).first()
    if not document:
        raise NotFoundError("文档未找到")

    if document.status == "deleted":
        raise ValidationError("已删除的文档不能重新索引")

    # Delete existing chunks
    session.query(Chunk).filter(Chunk.document_id == document_id).delete()

    queue_document_processing(document)
    document.version = (document.version or 1) + 1
    session.commit()
    session.refresh(document)

    if document.source_type == "url":
        task_name = "worker.fetch_and_process_url"
        task_type = "fetch_url"
    else:
        task_name = "worker.process_document"
        task_type = "parse"

    task = celery_app.send_task(task_name, args=[str(document.id)], queue="celery")

    ingestion_task = IngestionTask(
        document_id=document.id,
        task_type=task_type,
        celery_task_id=task.id,
        status="pending"
    )
    session.add(ingestion_task)
    session.commit()

    return DocumentResponse.model_validate(normalize_document_status(document))


@app.post("/kb/documents/{document_id}/learn", response_model=DocumentResponse)
async def learn_document(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Trigger document vectorization and structuring pipeline (parse → chunk → embed → index)."""
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user.sub
    ).first()
    if not document:
        raise NotFoundError("文档未找到")

    if document.status == "deleted":
        raise ValidationError("已删除的文档不能学习")
    normalized_document = normalize_document_status(document)
    if normalized_document.parse_status in {"pending", "processing"} or normalized_document.summary_status in {"pending", "processing"}:
        raise ValidationError("文档正在处理中，请稍后再试")

    session.query(Chunk).filter(Chunk.document_id == document_id).delete()
    session.query(Entity).filter(Entity.document_id == document_id).delete()

    queue_document_processing(document)
    document.version = (document.version or 1) + 1
    session.commit()
    session.refresh(document)

    if document.source_type == "url":
        task_name = "worker.fetch_and_process_url"
        task_type = "fetch_url"
    else:
        task_name = "worker.process_document"
        task_type = "parse"

    task = celery_app.send_task(task_name, args=[str(document.id)], queue="celery")

    ingestion_task = IngestionTask(
        document_id=document.id,
        task_type=task_type,
        celery_task_id=task.id,
        status="pending"
    )
    session.add(ingestion_task)
    session.commit()

    return DocumentResponse.model_validate(normalize_document_status(document))


@app.get("/kb/tasks", response_model=List[TaskResponse])
async def list_tasks(
    document_id: Optional[UUID] = None,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    query = session.query(IngestionTask).join(Document).filter(
        Document.owner_user_id == user.sub
    )
    if document_id:
        query = query.filter(IngestionTask.document_id == document_id)
    tasks = query.order_by(IngestionTask.created_at.desc()).all()
    return [TaskResponse.model_validate(task) for task in tasks]


# ============== FAQ CRUD ==============

@app.post("/kb/faq", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    data: FAQCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    faq = FAQEntry(
        owner_user_id=user.sub,
        knowledge_base_id=data.knowledge_base_id,
        question=data.question,
        answer=data.answer,
        similar_questions=data.similar_questions or [],
        tags=data.tags or []
    )
    session.add(faq)
    session.commit()
    session.refresh(faq)

    celery_app.send_task("worker.index_faq", args=[str(faq.id)], queue="celery")
    return FAQResponse.model_validate(faq)


@app.get("/kb/faq", response_model=List[FAQResponse])
async def list_faq(
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    knowledge_base_id: Optional[UUID] = None,
):
    q = session.query(FAQEntry).filter(FAQEntry.owner_user_id == user.sub)
    if knowledge_base_id is not None:
        q = q.filter(FAQEntry.knowledge_base_id == knowledge_base_id)
    entries = q.order_by(FAQEntry.created_at.desc()).offset(skip).limit(limit).all()
    return [FAQResponse.model_validate(e) for e in entries]


@app.put("/kb/faq/{faq_id}", response_model=FAQResponse)
async def update_faq(
    faq_id: UUID,
    data: FAQUpdate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    faq = session.query(FAQEntry).filter(
        FAQEntry.id == faq_id, FAQEntry.owner_user_id == user.sub
    ).first()
    if not faq:
        raise NotFoundError("FAQ未找到")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(faq, key, value)
    session.commit()
    session.refresh(faq)
    if "question" in update_data or "similar_questions" in update_data:
        celery_app.send_task("worker.index_faq", args=[str(faq.id)], queue="celery")
    return FAQResponse.model_validate(faq)


@app.delete("/kb/faq/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    faq_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    faq = session.query(FAQEntry).filter(
        FAQEntry.id == faq_id, FAQEntry.owner_user_id == user.sub
    ).first()
    if not faq:
        raise NotFoundError("FAQ未找到")
    session.delete(faq)
    session.commit()
    return None


@app.post("/kb/faq/import", status_code=status.HTTP_201_CREATED)
async def import_faq_csv(
    file: UploadFile = File(...),
    knowledge_base_id: Optional[UUID] = Query(None, description="归属的知识库 ID，不传则导入到全局 FAQ"),
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Batch import FAQ from CSV (columns: question, answer, similar_questions, tags)."""
    import csv
    import io

    if knowledge_base_id:
        kb = session.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_base_id).first()
        if not kb:
            raise HTTPException(status_code=404, detail="知识库不存在")
        if kb.owner_user_id != user.sub:
            raise HTTPException(status_code=403, detail="无权限向该知识库导入")

    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    created = 0

    for row in reader:
        question = row.get("question", "").strip()
        answer = row.get("answer", "").strip()
        if not question or not answer:
            continue
        similar = [s.strip() for s in row.get("similar_questions", "").split(";") if s.strip()]
        tags_list = [t.strip() for t in row.get("tags", "").split(",") if t.strip()]
        faq = FAQEntry(
            owner_user_id=user.sub,
            knowledge_base_id=knowledge_base_id,
            question=question,
            answer=answer,
            similar_questions=similar,
            tags=tags_list,
        )
        session.add(faq)
        created += 1

    session.commit()
    return {"imported": created, "message": f"成功导入 {created} 条FAQ"}


# ============== Tag Management ==============

@app.get("/kb/tags", response_model=List[TagResponse])
async def list_tags(
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    tags = session.query(Tag).order_by(Tag.name).all()
    return [TagResponse.model_validate(t) for t in tags]


@app.post("/kb/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: TagCreate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    existing = session.query(Tag).filter(Tag.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"标签 '{data.name}' 已存在")
    color = data.color or "#3B82F6"
    if not (len(color) == 7 and color[0] == "#" and all(c in "0123456789AaBbCcDdEeFf" for c in color[1:])):
        color = "#3B82F6"
    tag = Tag(name=data.name, color=color)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return TagResponse.model_validate(tag)


@app.delete("/kb/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    tag = session.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise NotFoundError("标签未找到")
    session.delete(tag)
    session.commit()
    return None


# ============== Chunk Management ==============

@app.get("/kb/documents/{document_id}/chunks", response_model=List[ChunkResponse])
async def list_chunks(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    doc = session.query(Document).filter(
        Document.id == document_id, Document.owner_user_id == user.sub
    ).first()
    if not doc:
        raise NotFoundError("文档未找到")
    chunks = session.query(Chunk).filter(
        Chunk.document_id == document_id
    ).order_by(Chunk.chunk_index).all()
    return [ChunkResponse.model_validate(c) for c in chunks]


@app.put("/kb/chunks/{chunk_id}", response_model=ChunkResponse)
async def update_chunk(
    chunk_id: UUID,
    data: ChunkUpdate,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    chunk = session.query(Chunk).join(Document).filter(
        Chunk.id == chunk_id, Document.owner_user_id == user.sub
    ).first()
    if not chunk:
        raise NotFoundError("分块未找到")

    update_data = data.model_dump(exclude_unset=True)
    text_changed = False
    for key, value in update_data.items():
        if key == "text" and value != chunk.text:
            text_changed = True
        setattr(chunk, key, value)

    if text_changed:
        import hashlib
        chunk.text_hash = hashlib.sha256(chunk.text.encode()).hexdigest()[:16]

    session.commit()
    session.refresh(chunk)

    if text_changed:
        celery_app.send_task("worker.reindex_chunk", args=[str(chunk_id)], queue="celery")

    return ChunkResponse.model_validate(chunk)


@app.patch("/kb/chunks/{chunk_id}/toggle", response_model=ChunkResponse)
async def toggle_chunk(
    chunk_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    chunk = session.query(Chunk).join(Document).filter(
        Chunk.id == chunk_id, Document.owner_user_id == user.sub
    ).first()
    if not chunk:
        raise NotFoundError("分块未找到")
    chunk.is_enabled = not chunk.is_enabled
    session.commit()
    session.refresh(chunk)
    return ChunkResponse.model_validate(chunk)


# ============== Entity Queries ==============

@app.get("/kb/documents/{document_id}/entities", response_model=List[EntityResponse])
async def list_entities(
    document_id: UUID,
    user: TokenPayload = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    doc = session.query(Document).filter(
        Document.id == document_id, Document.owner_user_id == user.sub
    ).first()
    if not doc:
        raise NotFoundError("文档未找到")
    entities = session.query(Entity).filter(Entity.document_id == document_id).all()
    return [EntityResponse.model_validate(e) for e in entities]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
