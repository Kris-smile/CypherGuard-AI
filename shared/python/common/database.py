"""Database connection and session management"""

from sqlalchemy import create_engine
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
