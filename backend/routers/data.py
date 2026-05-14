"""
Server-side paginated data endpoints for all tables.
GET /api/data/{table}?page=1&limit=50&sort=activity_date&order=desc&person=Karishma&search=john&date_from=2026-01-01&date_to=2026-05-31
GET /api/data/export/{table}?format=csv&person=Karishma&date_from=...&date_to=...
"""
import csv
import io
import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import desc as sa_desc, asc as sa_asc, or_, cast, Text as SAText, func, extract
from sqlalchemy.orm import Session

from database import get_db
from filters import resolve_period
from models import (
    Person, SourceFile, WorksheetMapping, TargetTracking, LinkedinConnection,
    LinkedinFollowup, LinkedinInmail, Email, PositiveResponse, LeadGenerated,
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
        "filters": [],
    },
    "linkedin-connections": {
        "model": LinkedinConnection,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "connection_message", "geography", "company_size", "industry",
            "cadence_sequence", "accepted", "filter_link", "response_received", "comments",
        ],
        "filters": ["geography", "company_size", "industry", "linkedin_account_used"],
    },
    "linkedin-followups": {
        "model": LinkedinFollowup,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "follow_up_type", "message_sent", "filter_value", "cadence", "response_received",
        ],
        "filters": ["follow_up_type", "linkedin_account_used", "cadence"],
    },
    "linkedin-inmails": {
        "model": LinkedinInmail,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_linkedin_url", "linkedin_account_used",
            "inmail_message_sent", "geography", "company_size", "industry", "filter_value", "cadence",
        ],
        "filters": ["geography", "company_size", "industry", "linkedin_account_used"],
    },
    "emails": {
        "model": Email,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "client_name", "client_email",
            "client_linkedin_url", "company_name", "email_content_sent",
            "opportunity_url", "contact_number", "reason", "next_step", "cadence",
        ],
        "filters": ["cadence", "reason"],
    },
    "positive-responses": {
        "model": PositiveResponse,
        "date_col": "response_date",
        "columns": [
            "response_date", "short_name", "client_type", "client_name",
            "client_linkedin_id", "linkedin_id_associated", "connected_date",
            "first_follow_up", "num_follow_ups_taken", "num_gap_days",
            "response_quality", "client_first_revert", "chat_summary", "source",
            "original_worksheet",
        ],
        "filters": ["client_type", "response_quality", "source"],
    },
    "leads-generated": {
        "model": LeadGenerated,
        "date_col": "inquiry_date",
        "dedup_cols": ["person_id", "client_name", "company_name"],
        "columns": [
            "inquiry_date", "short_name", "client_name", "company_name",
            "client_location", "company_size", "client_designation",
            "client_linkedin_url", "client_email", "client_contact_number",
            "summary", "next_step", "lead_source", "account",
            "assigned_consultant", "current_status", "status",
        ],
        "filters": ["lead_source", "status", "current_status", "account", "assigned_consultant"],
    },
    "data-extraction": {
        "model": DataExtractionRecord,
        "date_col": "activity_date",
        "columns": [
            "activity_date", "short_name", "prospect_name", "prospect_company",
            "client_email", "client_linkedin_url", "source_of_data",
            "region", "designation", "industry", "contact_number",
        ],
        "filters": ["source_of_data", "region", "industry", "designation"],
    },
    "biddetail-tenders": {
        "model": BiddetailTender,
        "date_col": None,
        "columns": [
            "short_name", "serial_no", "tender_no", "query_name",
            "amount", "company", "contact_person_name", "contact_details",
            "link_of_tender", "data_fetch_date", "contract_date",
        ],
        "filters": ["company"],
    },
}


def _build_query(db: Session, cfg: dict, person: str, date_from: str, date_to: str,
                  search: str, period: str = None, month: str = None,
                  column_filters: dict = None):
    Model = cfg["model"]
    q = db.query(Model, Person.short_name).outerjoin(Person, Model.person_id == Person.id)

    if person and person != "all":
        try:
            q = q.filter(Model.person_id == int(person))
        except (ValueError, TypeError):
            q = q.filter(Person.short_name == person)

    p_start, p_end = resolve_period(period) if period else (None, None)
    eff_from = p_start or (date_from if date_from else None)
    eff_to = p_end or (date_to if date_to else None)

    date_col_name = cfg["date_col"]
    if date_col_name:
        date_col = getattr(Model, date_col_name)
        if eff_from:
            try:
                d = eff_from if isinstance(eff_from, date) else date.fromisoformat(str(eff_from))
                q = q.filter(date_col >= d)
            except ValueError:
                pass
        if eff_to:
            try:
                d = eff_to if isinstance(eff_to, date) else date.fromisoformat(str(eff_to))
                q = q.filter(date_col <= d)
            except ValueError:
                pass

        if month:
            try:
                parts = month.split("-")
                y, m = int(parts[0]), int(parts[1])
                q = q.filter(extract("year", date_col) == y, extract("month", date_col) == m)
            except (ValueError, IndexError):
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

    if column_filters:
        for col_name, val in column_filters.items():
            if val and hasattr(Model, col_name):
                q = q.filter(getattr(Model, col_name) == val)

    dedup_cols = cfg.get("dedup_cols")
    if dedup_cols:
        dedup_exprs = [getattr(Model, c) for c in dedup_cols]
        subq = db.query(func.min(Model.id)).group_by(*dedup_exprs).subquery()
        q = q.filter(Model.id.in_(subq))

    return q


def _get_filter_options(db: Session, cfg: dict):
    Model = cfg["model"]
    filter_cols = cfg.get("filters", [])
    options = {}
    for col_name in filter_cols:
        if hasattr(Model, col_name):
            col = getattr(Model, col_name)
            vals = db.query(col).filter(col.isnot(None), col != "").distinct().order_by(col).all()
            options[col_name] = [v[0] for v in vals]
    if cfg["date_col"]:
        date_col = getattr(Model, cfg["date_col"])
        months = db.query(
            func.to_char(date_col, 'YYYY-MM')
        ).filter(date_col.isnot(None)).distinct().order_by(
            func.to_char(date_col, 'YYYY-MM').desc()
        ).all()
        options["month"] = [m[0] for m in months]
    return options


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


@router.get("/source-link")
def get_source_link(
    table: str = Query(...),
    row_id: int = Query(...),
    db: Session = Depends(get_db),
):
    cfg = TABLE_CONFIG.get(table)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    Model = cfg["model"]
    row = db.query(Model).filter(Model.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Row {row_id} not found in {table}")

    sf = db.query(SourceFile).filter(SourceFile.id == row.source_file_id).first()
    if not sf or not sf.drive_file_id:
        raise HTTPException(status_code=404, detail="Source file not found for this row")

    person = db.query(Person).filter(Person.id == row.person_id).first()
    person_name = person.full_name if person else "Unknown"

    drive_id = sf.drive_file_id
    file_name = sf.file_name or ""
    ws_name = getattr(row, "original_worksheet", None)

    wm = None
    if ws_name:
        wm = db.query(WorksheetMapping).filter(
            WorksheetMapping.source_file_id == sf.id,
            WorksheetMapping.worksheet_name == ws_name,
        ).first()

    if file_name.lower().endswith(".xlsx") or file_name.lower().endswith(".xls"):
        sheet_url = f"https://drive.google.com/file/d/{drive_id}/view"
    else:
        sheet_url = f"https://docs.google.com/spreadsheets/d/{drive_id}/edit"
        if wm and wm.worksheet_gid:
            sheet_url += f"#gid={wm.worksheet_gid}"

    return {
        "sheet_url": sheet_url,
        "worksheet_name": ws_name,
        "drive_file_id": drive_id,
        "person_name": person_name,
        "source_file_name": file_name,
        "worksheet_gid": wm.worksheet_gid if wm else None,
    }


KNOWN_PARAMS = {"table", "page", "limit", "sort", "order", "person", "date_from", "date_to", "period", "search", "month"}


@router.get("/{table}")
def get_table_data(
    request: Request,
    table: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query(None),
    order: str = Query("desc"),
    person: str = Query("all"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    period: str = Query(None),
    search: str = Query(None),
    month: str = Query(None),
    db: Session = Depends(get_db),
):
    cfg = TABLE_CONFIG.get(table)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    filter_cols = cfg.get("filters", [])
    column_filters = {}
    for key, val in request.query_params.items():
        if key in filter_cols and val:
            column_filters[key] = val

    q = _build_query(db, cfg, person, date_from, date_to, search, period, month, column_filters)
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

    filter_options = _get_filter_options(db, cfg)

    return {
        "data": [_row_to_dict(r, cfg) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "filter_options": filter_options,
    }


@router.get("/export/{table}")
def export_table(
    request: Request,
    table: str,
    format: str = Query("csv"),
    person: str = Query("all"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    period: str = Query(None),
    search: str = Query(None),
    month: str = Query(None),
    db: Session = Depends(get_db),
):
    cfg = TABLE_CONFIG.get(table)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    filter_cols = cfg.get("filters", [])
    column_filters = {}
    for key, val in request.query_params.items():
        if key in filter_cols and val:
            column_filters[key] = val

    q = _build_query(db, cfg, person, date_from, date_to, search, period, month, column_filters)

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
