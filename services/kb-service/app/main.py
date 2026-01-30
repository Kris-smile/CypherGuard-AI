"""KB Service - Knowledge base document management"""

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status, Form
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
from datetime import datetime

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User, Document, IngestionTask
from common.schemas import DocumentCreate, DocumentResponse, TaskResponse
from common.exceptions import NotFoundError, AuthenticationError

# Initialize app
app = FastAPI(
    title="KB Service",
    version="1.0.0",
    docs_url="/kb/docs",
    openapi_url="/kb/openapi.json",
    redoc_url="/kb/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = Settings()
db = Database(settings.postgres_url)

# Initialize MinIO client
minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure
)

# Initialize Celery client
celery_app = Celery(
    "kb-service",
    broker=settings.redis_url,
    backend=settings.redis_url
)


# Dependency to get database session
def get_db():
    return next(db.get_session())


# Simple auth dependency (for Phase 2, just check user_id header)
async def get_current_user_id(user_id: str = None) -> str:
    """Get current user ID from header (simplified for Phase 2)"""
    if not user_id:
        # For testing, use a default user ID
        return "00000000-0000-0000-0000-000000000001"
    return user_id


@app.on_event("startup")
async def startup_event():
    """Initialize MinIO bucket on startup"""
    try:
        if not minio_client.bucket_exists(settings.minio_bucket):
            minio_client.make_bucket(settings.minio_bucket)
            print(f"Created MinIO bucket: {settings.minio_bucket}")
    except S3Error as e:
        print(f"MinIO error: {e}")


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.post("/kb/documents/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Upload a document file"""
    # Use filename as title if not provided
    doc_title = title or file.filename

    # Parse tags
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    # Generate object name
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    object_name = f"{user_id}/{timestamp}_{file.filename}"

    try:
        # Upload to MinIO
        file_content = await file.read()
        from io import BytesIO
        minio_client.put_object(
            settings.minio_bucket,
            object_name,
            data=BytesIO(file_content),
            length=len(file_content),
            content_type=file.content_type or "application/octet-stream"
        )

        # Create document record
        document = Document(
            owner_user_id=user_id,
            title=doc_title,
            source_type="upload",
            source_uri=f"s3://{settings.minio_bucket}/{object_name}",
            mime_type=file.content_type,
            status="pending",
            tags=tag_list
        )

        session.add(document)
        session.commit()
        session.refresh(document)

        # Trigger processing task
        task = celery_app.send_task(
            "worker.process_document",
            args=[str(document.id)],
            queue="celery"
        )

        # Create ingestion task record
        ingestion_task = IngestionTask(
            document_id=document.id,
            task_type="parse",
            celery_task_id=task.id,
            status="pending"
        )
        session.add(ingestion_task)
        session.commit()

        return DocumentResponse.from_orm(document)

    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create document: {str(e)}"
        )


@app.get("/kb/documents", response_model=List[DocumentResponse])
async def list_documents(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List user's documents"""
    documents = session.query(Document).filter(
        Document.owner_user_id == user_id
    ).offset(skip).limit(limit).all()

    return [DocumentResponse.from_orm(doc) for doc in documents]


@app.get("/kb/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Get document by ID"""
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user_id
    ).first()

    if not document:
        raise NotFoundError("Document not found")

    return DocumentResponse.from_orm(document)


@app.delete("/kb/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """Delete a document"""
    document = session.query(Document).filter(
        Document.id == document_id,
        Document.owner_user_id == user_id
    ).first()

    if not document:
        raise NotFoundError("Document not found")

    # Update status to deleted
    document.status = "deleted"
    session.commit()

    return None


@app.get("/kb/tasks", response_model=List[TaskResponse])
async def list_tasks(
    document_id: Optional[UUID] = None,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_db)
):
    """List ingestion tasks"""
    query = session.query(IngestionTask).join(Document).filter(
        Document.owner_user_id == user_id
    )

    if document_id:
        query = query.filter(IngestionTask.document_id == document_id)

    tasks = query.all()
    return [TaskResponse.from_orm(task) for task in tasks]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
