"""Audit logging - records user actions to the audit_logs table."""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Text, JSON, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from .database import Base

logger = logging.getLogger(__name__)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


def write_audit_log(
    session: Session,
    action: str,
    user_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None
):
    """Write an audit log entry. Fails silently to avoid disrupting main flow."""
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            meta_json=meta
        )
        session.add(entry)
        session.commit()
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")
        try:
            session.rollback()
        except Exception:
            pass
