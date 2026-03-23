"""Database connection and session management"""

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

Base = declarative_base()


class Database:
    """Database connection manager"""

    def __init__(self, database_url: str):
        self.engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )

    def get_session(self) -> Generator[Session, None, None]:
        """Get database session"""
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def create_tables(self):
        """Create all tables (for testing)"""
        Base.metadata.create_all(bind=self.engine)

    def ensure_document_processing_columns(self):
        """Add staged document-processing columns and backfill legacy rows."""
        inspector = inspect(self.engine)
        if "documents" not in inspector.get_table_names():
            return

        columns = {column["name"] for column in inspector.get_columns("documents")}
        with self.engine.begin() as connection:
            if "parse_status" not in columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN parse_status VARCHAR(20)"))
            if "summary_status" not in columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN summary_status VARCHAR(20)"))

            connection.execute(text("ALTER TABLE documents ALTER COLUMN parse_status SET DEFAULT 'pending'"))
            connection.execute(text("ALTER TABLE documents ALTER COLUMN summary_status SET DEFAULT 'pending'"))

            connection.execute(text("""
                UPDATE documents
                SET parse_status = CASE
                    WHEN status = 'ready' THEN 'completed'
                    WHEN status = 'failed' THEN 'failed'
                    WHEN status = 'processing' THEN 'processing'
                    ELSE 'pending'
                END
                WHERE parse_status IS NULL
                   OR parse_status = ''
                   OR parse_status NOT IN ('pending', 'processing', 'completed', 'failed')
                   OR (status = 'ready' AND parse_status IN ('pending', 'processing'))
                   OR (status = 'failed' AND parse_status IN ('pending', 'processing'))
            """))

            connection.execute(text("""
                UPDATE documents
                SET summary_status = CASE
                    WHEN status = 'failed' THEN 'failed'
                    WHEN status = 'ready' THEN 'completed'
                    ELSE 'pending'
                END
                WHERE summary_status IS NULL
                   OR summary_status = ''
                   OR summary_status NOT IN ('pending', 'processing', 'completed', 'failed')
                   OR (status = 'ready' AND summary_status IN ('pending', 'processing'))
                   OR (status = 'failed' AND summary_status IN ('pending', 'processing'))
            """))
