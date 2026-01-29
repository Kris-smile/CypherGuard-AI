"""Worker - Celery tasks for document processing"""

from celery import Celery
import os
import sys
import hashlib
import httpx
from typing import List, Dict, Any
from io import BytesIO

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import Document, IngestionTask, Chunk

# Initialize settings and database
settings = Settings()
db = Database(settings.postgres_url)

# Initialize Celery
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

# MinIO client
from minio import Minio
minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure
)

# Qdrant client
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
qdrant_client = QdrantClient(url=settings.qdrant_url)

# Collection name
COLLECTION_NAME = "kb_chunks_v1"
VECTOR_SIZE = 384


def ensure_collection_exists():
    """Ensure Qdrant collection exists"""
    try:
        collections = qdrant_client.get_collections().collections
        if not any(c.name == COLLECTION_NAME for c in collections):
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
            )
            print(f"[Worker] Created Qdrant collection: {COLLECTION_NAME}")
    except Exception as e:
        print(f"[Worker] Error creating collection: {e}")


def download_file_from_minio(source_uri: str) -> bytes:
    """Download file from MinIO"""
    # Parse s3://bucket/path format
    if source_uri.startswith("s3://"):
        parts = source_uri[5:].split("/", 1)
        bucket = parts[0]
        object_name = parts[1] if len(parts) > 1 else ""
    else:
        raise ValueError(f"Invalid source URI: {source_uri}")

    response = minio_client.get_object(bucket, object_name)
    content = response.read()
    response.close()
    response.release_conn()
    return content


def extract_text(content: bytes, mime_type: str) -> str:
    """Extract text from document content"""
    if mime_type in ["text/plain", "text/markdown"]:
        return content.decode("utf-8", errors="ignore")

    elif mime_type == "application/pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        except Exception as e:
            print(f"[Worker] PDF extraction error: {e}")
            return ""

    elif mime_type in ["text/html", "application/xhtml+xml"]:
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, "lxml")
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            return soup.get_text(separator="\n", strip=True)
        except Exception as e:
            print(f"[Worker] HTML extraction error: {e}")
            return content.decode("utf-8", errors="ignore")

    else:
        # Try to decode as text
        return content.decode("utf-8", errors="ignore")


def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[Dict[str, Any]]:
    """Split text into overlapping chunks"""
    chunks = []
    paragraphs = text.split("\n\n")

    current_chunk = ""
    chunk_index = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 <= max_chunk_size:
            current_chunk += ("\n\n" if current_chunk else "") + para
        else:
            if current_chunk:
                chunks.append({
                    "index": chunk_index,
                    "text": current_chunk,
                    "text_hash": hashlib.sha256(current_chunk.encode()).hexdigest()[:16]
                })
                chunk_index += 1

                # Keep overlap from end of current chunk
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk = para

    # Add final chunk
    if current_chunk:
        chunks.append({
            "index": chunk_index,
            "text": current_chunk,
            "text_hash": hashlib.sha256(current_chunk.encode()).hexdigest()[:16]
        })

    return chunks


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings from model gateway"""
    model_gateway_url = os.getenv("MODEL_GATEWAY_URL", "http://model-gateway:8000")

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{model_gateway_url}/internal/embeddings",
            json={"texts": texts}
        )
        response.raise_for_status()
        return response.json()["embeddings"]


def index_to_qdrant(document_id: str, document_title: str, source_type: str,
                    source_uri: str, chunks: List[Dict], embeddings: List[List[float]]):
    """Index chunks to Qdrant"""
    ensure_collection_exists()

    points = []
    for chunk, embedding in zip(chunks, embeddings):
        point_id = hashlib.md5(f"{document_id}_{chunk['index']}".encode()).hexdigest()

        points.append(PointStruct(
            id=point_id,
            vector=embedding,
            payload={
                "chunk_id": point_id,
                "document_id": str(document_id),
                "title": document_title,
                "source_type": source_type,
                "source_uri": source_uri,
                "chunk_index": chunk["index"],
                "text": chunk["text"],
                "text_hash": chunk["text_hash"]
            }
        ))

    if points:
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"[Worker] Indexed {len(points)} chunks to Qdrant")


@celery_app.task(name="worker.process_document", bind=True)
def process_document(self, document_id: str):
    """Process a document: parse, chunk, embed, and index"""
    print(f"[Worker] Processing document: {document_id}")

    session = next(db.get_session())

    try:
        # Get document
        document = session.query(Document).filter(Document.id == document_id).first()
        if not document:
            print(f"[Worker] Document not found: {document_id}")
            return {"status": "error", "message": "Document not found"}

        # Update document status
        document.status = "processing"
        session.commit()

        # Get ingestion task
        task = session.query(IngestionTask).filter(
            IngestionTask.document_id == document_id
        ).order_by(IngestionTask.created_at.desc()).first()

        if task:
            task.status = "running"
            task.progress = 10
            session.commit()

        # Step 1: Download and parse document
        print(f"[Worker] Step 1: Downloading document {document.title}")
        content = download_file_from_minio(document.source_uri)

        if task:
            task.progress = 20
            session.commit()

        # Step 2: Extract text
        print(f"[Worker] Step 2: Extracting text")
        text = extract_text(content, document.mime_type or "text/plain")
        print(f"[Worker] Extracted {len(text)} characters")

        if task:
            task.progress = 40
            session.commit()

        # Step 3: Chunk text
        print(f"[Worker] Step 3: Chunking text")
        chunks = chunk_text(text)
        print(f"[Worker] Created {len(chunks)} chunks")

        if task:
            task.progress = 50
            session.commit()

        # Save chunks to database
        for chunk_data in chunks:
            chunk = Chunk(
                document_id=document.id,
                chunk_index=chunk_data["index"],
                text=chunk_data["text"],
                text_hash=chunk_data["text_hash"]
            )
            session.add(chunk)
        session.commit()

        if task:
            task.progress = 60
            session.commit()

        # Step 4: Generate embeddings
        print(f"[Worker] Step 4: Generating embeddings")
        chunk_texts = [c["text"] for c in chunks]
        embeddings = get_embeddings(chunk_texts)
        print(f"[Worker] Generated {len(embeddings)} embeddings")

        if task:
            task.progress = 80
            session.commit()

        # Step 5: Index to Qdrant
        print(f"[Worker] Step 5: Indexing to Qdrant")
        index_to_qdrant(
            document_id=str(document.id),
            document_title=document.title,
            source_type=document.source_type,
            source_uri=document.source_uri,
            chunks=chunks,
            embeddings=embeddings
        )

        if task:
            task.progress = 100
            task.status = "success"
            session.commit()

        # Mark document as ready
        document.status = "ready"
        session.commit()

        print(f"[Worker] Document processed successfully: {document_id}")
        return {"status": "success", "document_id": document_id, "chunks": len(chunks)}

    except Exception as e:
        print(f"[Worker] Error processing document {document_id}: {str(e)}")
        import traceback
        traceback.print_exc()

        document.status = "failed"
        if task:
            task.status = "failed"
            task.error_message = str(e)
        session.commit()
        return {"status": "error", "message": str(e)}

    finally:
        session.close()


@celery_app.task(name="worker.test_task")
def test_task():
    """Test task to verify Celery is working"""
    print("[Worker] Test task running!")
    return "Task completed"


if __name__ == "__main__":
    celery_app.start()
