"""Worker - Celery tasks for document processing"""

from celery import Celery
import os
import sys
import time
from sqlalchemy.orm import Session

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import Document, IngestionTask

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
            IngestionTask.document_id == document_id,
            IngestionTask.celery_task_id == self.request.id
        ).first()

        if task:
            task.status = "running"
            task.progress = 10
            session.commit()

        # Phase 2: Just log the processing steps
        print(f"[Worker] Step 1: Parsing document {document.title}")
        time.sleep(1)

        if task:
            task.progress = 30
            session.commit()

        print(f"[Worker] Step 2: Chunking document")
        time.sleep(1)

        if task:
            task.progress = 60
            session.commit()

        print(f"[Worker] Step 3: Embedding chunks")
        time.sleep(1)

        if task:
            task.progress = 90
            session.commit()

        print(f"[Worker] Step 4: Indexing to vector database")
        time.sleep(1)

        # Mark as complete
        document.status = "ready"
        if task:
            task.status = "success"
            task.progress = 100
        session.commit()

        print(f"[Worker] Document processed successfully: {document_id}")
        return {"status": "success", "document_id": document_id}

    except Exception as e:
        print(f"[Worker] Error processing document {document_id}: {str(e)}")
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
    time.sleep(1)
    return "Task completed"


if __name__ == "__main__":
    celery_app.start()
