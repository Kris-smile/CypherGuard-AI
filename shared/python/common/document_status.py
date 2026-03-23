"""Helpers for staged document processing status."""

from __future__ import annotations

from typing import Any

PARSE_PENDING = "pending"
PARSE_PROCESSING = "processing"
PARSE_COMPLETED = "completed"
PARSE_FAILED = "failed"

SUMMARY_PENDING = "pending"
SUMMARY_PROCESSING = "processing"
SUMMARY_COMPLETED = "completed"
SUMMARY_FAILED = "failed"

VALID_PARSE_STATUSES = {
    PARSE_PENDING,
    PARSE_PROCESSING,
    PARSE_COMPLETED,
    PARSE_FAILED,
}

VALID_SUMMARY_STATUSES = {
    SUMMARY_PENDING,
    SUMMARY_PROCESSING,
    SUMMARY_COMPLETED,
    SUMMARY_FAILED,
}


def _set_if_present(document: Any, field: str, value: str) -> None:
    if hasattr(document, field):
        setattr(document, field, value)


def queue_document_processing(document: Any) -> Any:
    document.status = "processing"
    _set_if_present(document, "parse_status", PARSE_PENDING)
    _set_if_present(document, "summary_status", SUMMARY_PENDING)
    if hasattr(document, "summary"):
        document.summary = None
    return document


def mark_parse_processing(document: Any) -> Any:
    document.status = "processing"
    _set_if_present(document, "parse_status", PARSE_PROCESSING)
    if getattr(document, "summary_status", None) not in VALID_SUMMARY_STATUSES:
        _set_if_present(document, "summary_status", SUMMARY_PENDING)
    return document


def mark_parse_completed(document: Any) -> Any:
    document.status = "ready"
    _set_if_present(document, "parse_status", PARSE_COMPLETED)
    _set_if_present(document, "summary_status", SUMMARY_PENDING)
    return document


def mark_summary_processing(document: Any) -> Any:
    if document.status != "deleted":
        document.status = "ready"
    _set_if_present(document, "summary_status", SUMMARY_PROCESSING)
    return document


def mark_summary_completed(document: Any) -> Any:
    if document.status != "deleted":
        document.status = "ready"
    _set_if_present(document, "summary_status", SUMMARY_COMPLETED)
    return document


def mark_document_failed(document: Any, stage: str = "parse") -> Any:
    document.status = "failed"
    if stage == "summary":
        if getattr(document, "parse_status", None) != PARSE_COMPLETED:
            _set_if_present(document, "parse_status", PARSE_FAILED)
        _set_if_present(document, "summary_status", SUMMARY_FAILED)
    else:
        _set_if_present(document, "parse_status", PARSE_FAILED)
        _set_if_present(document, "summary_status", SUMMARY_FAILED)
    return document


def normalize_document_status(document: Any) -> Any:
    legacy_status = getattr(document, "status", None)
    parse_status = getattr(document, "parse_status", None)
    summary_status = getattr(document, "summary_status", None)
    summary = (getattr(document, "summary", None) or "").strip()

    if legacy_status == "ready":
        if parse_status in {None, "", PARSE_PENDING, PARSE_PROCESSING}:
            parse_status = PARSE_COMPLETED
        if summary_status in {None, ""}:
            summary_status = SUMMARY_COMPLETED
    elif legacy_status == "failed":
        if parse_status in {None, "", PARSE_PENDING, PARSE_PROCESSING}:
            parse_status = PARSE_FAILED
        if summary_status in {None, "", SUMMARY_PENDING, SUMMARY_PROCESSING}:
            summary_status = SUMMARY_FAILED
    elif legacy_status == "processing":
        if parse_status in {None, ""}:
            parse_status = PARSE_PROCESSING
        if summary_status in {None, ""}:
            summary_status = SUMMARY_PENDING
    else:
        if parse_status not in VALID_PARSE_STATUSES:
            parse_status = PARSE_PENDING
        if summary_status not in VALID_SUMMARY_STATUSES:
            summary_status = SUMMARY_PENDING

    if parse_status == PARSE_COMPLETED and summary and summary_status in {
        None,
        "",
        SUMMARY_PENDING,
    }:
        summary_status = SUMMARY_COMPLETED

    if parse_status not in VALID_PARSE_STATUSES:
        parse_status = PARSE_PENDING
    if summary_status not in VALID_SUMMARY_STATUSES:
        summary_status = SUMMARY_PENDING

    document.parse_status = parse_status
    document.summary_status = summary_status

    if legacy_status == "deleted":
        document.status = "deleted"
    elif parse_status == PARSE_FAILED:
        document.status = "failed"
    elif parse_status == PARSE_COMPLETED:
        document.status = "ready"
    elif parse_status in {PARSE_PENDING, PARSE_PROCESSING}:
        document.status = "processing"

    return document
