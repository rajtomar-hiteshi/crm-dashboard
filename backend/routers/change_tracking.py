"""
Change Tracking API — cell-level edit history with 24-hour deadline enforcement.
"""
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


TABLE_DISPLAY = {
    'target_tracking': 'Target Tracking',
    'linkedin_connections': 'LinkedIn Connections',
    'linkedin_followups': 'LinkedIn Follow-Ups',
    'linkedin_inmails': 'LinkedIn InMails',
    'emails': 'Emails',
    'data_extraction': 'Data Extraction',
    'positive_responses': 'Positive Responses',
    'leads_generated': 'Leads Generated',
}


@router.get("/change-tracking")
def get_change_log(
    employee: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    table: str = Query(None),
    status: str = Query("all"),  # all, applied, rejected
    change_type: str = Query(None),  # UPDATED, NEW_ROW, REJECTED_UPDATE, REJECTED_NEW
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return paginated change log with filtering."""
    where_clauses = []
    params = {}

    if employee and employee != "all":
        where_clauses.append("p.short_name = :emp")
        params["emp"] = employee

    if date_from:
        where_clauses.append("cl.row_date >= :df")
        params["df"] = date_from

    if date_to:
        where_clauses.append("cl.row_date <= :dt")
        params["dt"] = date_to

    if table and table != "all":
        where_clauses.append("cl.target_table = :tbl")
        params["tbl"] = table

    if status == "applied":
        where_clauses.append("cl.change_applied = true")
    elif status == "rejected":
        where_clauses.append("cl.change_applied = false")

    if change_type:
        where_clauses.append("cl.change_type = :ct")
        params["ct"] = change_type

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # Count total
    count_sql = f"""
        SELECT COUNT(*)
        FROM change_log cl
        JOIN persons p ON p.id = cl.person_id
        {where_sql}
    """
    total = db.execute(text(count_sql), params).scalar() or 0

    # Fetch page
    offset = (page - 1) * limit
    params["lim"] = limit
    params["off"] = offset

    data_sql = f"""
        SELECT cl.id, cl.person_id, p.short_name, p.full_name,
               cl.target_table, cl.original_worksheet, cl.row_date,
               cl.column_name, cl.column_display,
               cl.old_value, cl.new_value,
               cl.change_type, cl.within_deadline, cl.change_applied,
               cl.deadline_at, cl.detected_at, cl.target_row_id,
               cl.sync_run_id
        FROM change_log cl
        JOIN persons p ON p.id = cl.person_id
        {where_sql}
        ORDER BY cl.detected_at DESC, cl.id DESC
        LIMIT :lim OFFSET :off
    """
    rows = db.execute(text(data_sql), params).fetchall()

    data = []
    for r in rows:
        data.append({
            "id": r[0],
            "person_id": r[1],
            "person_short": r[2],
            "person_name": r[3],
            "target_table": r[4],
            "table_display": TABLE_DISPLAY.get(r[4], r[4]),
            "original_worksheet": r[5],
            "row_date": str(r[6]) if r[6] else None,
            "column_name": r[7],
            "column_display": r[8],
            "old_value": r[9],
            "new_value": r[10],
            "change_type": r[11],
            "within_deadline": r[12],
            "change_applied": r[13],
            "deadline_at": r[14].isoformat() if r[14] else None,
            "detected_at": r[15].isoformat() if r[15] else None,
            "target_row_id": r[16],
            "sync_run_id": r[17],
        })

    # Summary counts
    summary_sql = f"""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE cl.change_applied = true) AS applied,
            COUNT(*) FILTER (WHERE cl.change_applied = false) AS rejected,
            COUNT(*) FILTER (WHERE cl.change_type = 'UPDATED') AS updated,
            COUNT(*) FILTER (WHERE cl.change_type = 'REJECTED_UPDATE') AS rejected_updates,
            COUNT(*) FILTER (WHERE cl.change_type = 'REJECTED_NEW') AS rejected_new
        FROM change_log cl
        JOIN persons p ON p.id = cl.person_id
        {where_sql}
    """
    # Remove limit/offset from params for summary
    sum_params = {k: v for k, v in params.items() if k not in ('lim', 'off')}
    s = db.execute(text(summary_sql), sum_params).fetchone()

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "summary": {
            "total_changes": s[0] if s else 0,
            "applied": s[1] if s else 0,
            "rejected": s[2] if s else 0,
            "updated": s[3] if s else 0,
            "rejected_updates": s[4] if s else 0,
            "rejected_new": s[5] if s else 0,
        },
    }


@router.get("/change-tracking/employees")
def get_change_log_employees(db: Session = Depends(get_db)):
    """Return list of employees that have change log entries."""
    rows = db.execute(text("""
        SELECT DISTINCT p.short_name, p.full_name
        FROM change_log cl
        JOIN persons p ON p.id = cl.person_id
        ORDER BY p.short_name
    """)).fetchall()
    return [{"short_name": r[0], "full_name": r[1]} for r in rows]


@router.get("/change-tracking/tables")
def get_change_log_tables(db: Session = Depends(get_db)):
    """Return list of tables that have change log entries."""
    rows = db.execute(text("""
        SELECT DISTINCT target_table FROM change_log ORDER BY target_table
    """)).fetchall()
    return [{"value": r[0], "label": TABLE_DISPLAY.get(r[0], r[0])} for r in rows]
