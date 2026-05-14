"""
Server-side paginated data endpoints for all tables.
GET /api/data/{table}?page=1&limit=50&sort=activity_date&order=desc&person=Karishma&search=john&date_from=2026-01-01&date_to=2026-05-31
GET /api/data/export/{table}?format=csv&person=Karishma&date_from=...&date_to=...
"""
import csv
import io
import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import desc as sa_desc, asc as sa_asc, or_, cast, Text as SAText
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Person, TargetTracking, LinkedinConnection, LinkedinFollowup,
    LinkedinInmail, Email, PositiveResponse, LeadGenerated,
    DataExtractionRecord, BiddetailTender, OtherWorksheetData,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data", tags=["data"])

# ── Table config: model, date column, columns to expose ─────────────
TABLE_CONFIG = {
    "target-tracking": {
        "model": TargetTracking,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "linkedin_connections", "linkedin_follow_ups",
            "linkedin_inmails", "emails", "data_extraction", "cold_calling",
            "follow_up_calls", "positive_responses", "leads_generated", "calls", "comments",
        ],
    },
    "linkedin-connections": {
        "model": LinkedinConnection,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "connection_message", "geography", "company_size", "industry",
            "cadence_sequence", "accepted", "filter_link", "response_received", "comments",
        ],
    },
    "linkedin-followups": {
        "model": LinkedinFollowup,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "follow_up_type", "message_sent", "filter_value", "cadence", "response_received",
        ],
    },
    "linkedin-inmails": {
        "model": LinkedinInmail,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "inmail_message_sent", "geography", "company_size", "industry", "filter_value", "cadence",
        ],
    },
    "emails": {
        "model": Email,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_name", "client_email",
            "client_linkedin_url", "company_name", "email_content_sent",
            "opportunity_url", "contact_number", "reason", "next_step", "cadence",
        ],
    },
    "positive-responses": {
        "model": PositiveResponse,
        "date_col": "response_date",
        "columns": [
            "response_date", "short_name", "client_type", "client_name",
            "client_linkedin_id", "linkedin_id_associated", "connected_date",
            "first_follow_up", "num_follow_ups_taken", "num_gap_days",
            "response_quality", "client_first_revert", "chat_summary", "source",
        ],
    },
    "leads-generated": {
        "model": LeadGenerated,
        "date_col": "inquiry_date",
        "columns": [
            "inquiry_date", "short_name", "client_name", "company_name",
            "client_location", "company_size", "client_designation",
            "client_linkedin_url", "client_email", "client_contact_number",
            "summary", "next_step", "lead_source", "account",
            "assigned_consultant", "current_status", "status",
        ],
    },
    "data-extraction": {
        "model": DataExtractionRecord,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "prospect_name", "prospect_company",
            "client_email", "client_linkedin_url", "source_of_data",
            "region", "designation", "industry", "contact_number",
        ],
    },
    "biddetail-tenders": {
        "model": BiddetailTender,
        "date_col": None,
        "columns": [
            "short_name", "serial_no", "tender_no", "query_name",
            "amount", "company", "contact_person_name", "contact_details",
            "link_of_tender", "data_fetch_date", "contract_date",
        ],
    },
}


def _build_query(db: Session, cfg: dict, person: str, date_from: str, date_to: str, search: str):
    """Build a filtered query with Person join."""
    Model = cfg["model"]
    q = db.query(Model, Person.short_name).join(Person, Model.person_id == Person.id)

    if person and person != "all":
        try:
            q = q.filter(Model.person_id == int(person))
        except (ValueError, TypeError):
            q = q.filter(Person.short_name == person)

    date_col_name = cfg["date_col"]
    if date_col_name:
        date_col = getattr(Model, date_col_name)
        if date_from:
            try:
                q = q.filter(date_col >= date.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                q = q.filter(date_col <= date.fromisoformat(date_to))
            except ValueError:
                pass

    if search:
        search_cols = []
        for col_name in cfg["columns"]:
            if col_name == "short_name":
                search_cols.append(cast(Person.short_name, SAText).ilike(f"%{search}%"))
            elif hasattr(Model, col_name):
                search_cols.append(cast(getattr(Model, col_name), SAText).ilike(f"%{search}%"))
        if search_cols:
            q = q.filter(or_(*search_cols))

    return q


def _row_to_dict(row, cfg: dict) -> dict:
    """Convert a (Model, short_name) row to a dict."""
    obj, short_name = row
    d = {}
    for col_name in cfg["columns"]:
        if col_name == "short_name":
            d["short_name"] = short_name
        else:
            val = getattr(obj, col_name, None)
            if isinstance(val, date):
                d[col_name] = val.isoformat()
            else:
                d[col_name] = val
    d["id"] = obj.id
    return d


@router.get("/{table}")
def get_table_data(
    table: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query(None),
    order: str = Query("desc"),
    person: str = Query("all"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    cfg = TABLE_CONFIG.get(table)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    q = _build_query(db, cfg, person, date_from, date_to, search)
    total = q.count()

    sort_col = None
    if sort:
        Model = cfg["model"]
        if sort == "short_name":
            sort_col = Person.short_name
        elif hasattr(Model, sort):
            sort_col = getattr(Model, sort)
    if sort_col is None and cfg["date_col"]:
        sort_col = getattr(cfg["model"], cfg["date_col"])
    if sort_col is None:
        sort_col = cfg["model"].id

    q = q.order_by(sa_desc(sort_col) if order == "desc" else sa_asc(sort_col))
    q = q.offset((page - 1) * limit).limit(limit)
    rows = q.all()

    return {
        "data": [_row_to_dict(r, cfg) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/export/{table}")
def export_table(
    table: str,
    format: str = Query("csv"),
    person: str = Query("all"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    cfg = TABLE_CONFIG.get(table)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    q = _build_query(db, cfg, person, date_from, date_to, search)

    if cfg["date_col"]:
        sort_col = getattr(cfg["model"], cfg["date_col"])
        q = q.order_by(sa_desc(sort_col))
    rows = q.all()

    output = io.StringIO()
    columns = cfg["columns"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for r in rows:
        writer.writerow(_row_to_dict(r, cfg))
    output.seek(0)

    filename = f"{table}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
