import csv
import io
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    TargetTracking, Person, DailyTarget,
    LinkedinConnection, LinkedinFollowup, LinkedinInmail,
    Email, DataExtractionRecord, PositiveResponse, LeadGenerated,
)
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()

ACTIVITY_FIELDS = {
    "connections": "linkedin_connections",
    "followups": "linkedin_follow_ups",
    "inmails": "linkedin_inmails",
    "emails": "emails",
    "data_extraction": "data_extraction",
    "positive_responses": "positive_responses",
    "leads": "leads_generated",
}

DEFAULT_TARGETS = {
    "target_connections": 100,
    "target_followups": 100,
    "target_inmails": 30,
    "target_emails": 10,
    "target_data_extraction": 0,
    "target_positive_responses": 2,
    "target_leads": 1,
}


def _parse_date(s):
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _get_targets(db: Session):
    t = db.query(DailyTarget).first()
    if t:
        return {
            "connections": t.target_connections or 100,
            "followups": t.target_followups or 100,
            "inmails": t.target_inmails or 30,
            "emails": t.target_emails or 10,
            "data_extraction": t.target_data_extraction or 0,
            "positive_responses": t.target_positive_responses or 2,
            "leads": t.target_leads or 1,
        }
    return {
        "connections": 100, "followups": 100, "inmails": 30,
        "emails": 10, "data_extraction": 0, "positive_responses": 2, "leads": 1,
    }


def _compute_comparison(current_total, previous_total):
    if previous_total == 0:
        if current_total > 0:
            return 100.0
        return 0.0
    return round((current_total - previous_total) / previous_total * 100, 1)


def _get_previous_period(date_from, date_to):
    delta = (date_to - date_from).days + 1
    prev_to = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=delta - 1)
    return prev_from, prev_to


def _aggregate_period(db, person_ids, date_from, date_to):
    base = db.query(TargetTracking).filter(
        TargetTracking.activity_date.isnot(None),
        TargetTracking.activity_date >= date_from,
        TargetTracking.activity_date <= date_to,
    )
    if person_ids:
        base = base.filter(TargetTracking.person_id.in_(person_ids))
    rows = base.all()
    totals = {k: 0 for k in ACTIVITY_FIELDS}
    for r in rows:
        for key, field in ACTIVITY_FIELDS.items():
            totals[key] += safe_int(getattr(r, field))
    return totals


@router.get("/daily-activity")
def get_daily_activity(
    persons: str = Query(None),
    date: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query("all"),
    db: Session = Depends(get_db),
):
    today = datetime.now().date()
    d_from = _parse_date(date_from) or _parse_date(date) or today
    d_to = _parse_date(date_to) or _parse_date(date) or today
    is_single_day = (d_from == d_to)

    all_persons = db.query(Person).order_by(Person.full_name).all()
    person_map = {p.id: p for p in all_persons}

    person_ids = []
    if persons:
        try:
            person_ids = [int(x) for x in persons.split(",") if x.strip()]
        except ValueError:
            person_ids = []
    if not person_ids:
        person_ids = [p.id for p in all_persons]

    activity_types = []
    if type and type != "all":
        activity_types = [t.strip() for t in type.split(",")]

    base = db.query(TargetTracking).filter(
        TargetTracking.activity_date.isnot(None),
        TargetTracking.activity_date >= d_from,
        TargetTracking.activity_date <= d_to,
        TargetTracking.person_id.in_(person_ids),
    )
    rows = base.order_by(TargetTracking.activity_date).all()

    targets = _get_targets(db)

    prev_from, prev_to = _get_previous_period(d_from, d_to)
    current_totals = _aggregate_period(db, person_ids, d_from, d_to)
    previous_totals = _aggregate_period(db, person_ids, prev_from, prev_to)

    summary_cards = []
    card_defs = [
        ("connections", "Total Connections"),
        ("followups", "Total Follow Ups"),
        ("inmails", "Total InMails"),
        ("emails", "Total Emails"),
        ("positive_responses", "Total Positive Responses"),
        ("leads", "Total Leads"),
    ]
    for key, label in card_defs:
        if activity_types and key not in activity_types:
            continue
        change = _compute_comparison(current_totals[key], previous_totals[key])
        summary_cards.append({
            "key": key,
            "label": label,
            "value": current_totals[key],
            "previous": previous_totals[key],
            "change": change,
        })

    person_rows = {}
    for r in rows:
        pid = r.person_id
        if pid not in person_rows:
            person_rows[pid] = {
                "dates": {},
                "totals": {k: 0 for k in ACTIVITY_FIELDS},
            }
        d_key = r.activity_date.isoformat()
        if d_key not in person_rows[pid]["dates"]:
            person_rows[pid]["dates"][d_key] = {k: 0 for k in ACTIVITY_FIELDS}
        for key, field in ACTIVITY_FIELDS.items():
            val = safe_int(getattr(r, field))
            person_rows[pid]["dates"][d_key][key] += val
            person_rows[pid]["totals"][key] += val

    table_data = []
    for pid in person_ids:
        p = person_map.get(pid)
        if not p:
            continue
        pr = person_rows.get(pid)
        if not pr:
            if is_single_day:
                entry = {
                    "person_id": pid,
                    "person_name": p.short_name or p.full_name,
                    "full_name": p.full_name,
                    "date": d_from.isoformat(),
                    "color": PERSON_COLORS.get(p.short_name, "#666"),
                    "connections": None,
                    "followups": None,
                    "inmails": None,
                    "emails": None,
                    "data_extraction": None,
                    "positive_responses": None,
                    "leads": None,
                    "total_activity": 0,
                }
                table_data.append(entry)
            continue

        if is_single_day:
            day_data = pr["dates"].get(d_from.isoformat(), {})
            has_data = bool(day_data)
            entry = {
                "person_id": pid,
                "person_name": p.short_name or p.full_name,
                "full_name": p.full_name,
                "date": d_from.isoformat(),
                "color": PERSON_COLORS.get(p.short_name, "#666"),
            }
            total = 0
            for key in ACTIVITY_FIELDS:
                if activity_types and key not in activity_types:
                    entry[key] = None
                    continue
                val = day_data.get(key, 0) if has_data else None
                entry[key] = val
                if val:
                    total += val
            entry["total_activity"] = total
            table_data.append(entry)
        else:
            num_days = len(pr["dates"])
            entry = {
                "person_id": pid,
                "person_name": p.short_name or p.full_name,
                "full_name": p.full_name,
                "date_from": d_from.isoformat(),
                "date_to": d_to.isoformat(),
                "num_days": num_days,
                "color": PERSON_COLORS.get(p.short_name, "#666"),
            }
            total = 0
            for key in ACTIVITY_FIELDS:
                if activity_types and key not in activity_types:
                    entry[f"total_{key}"] = None
                    entry[f"avg_{key}"] = None
                    continue
                t = pr["totals"][key]
                entry[f"total_{key}"] = t
                entry[f"avg_{key}"] = round(t / max(num_days, 1), 1)
                total += t
            entry["total_activity"] = total

            daily_values = sorted(pr["dates"].items())
            best_day = None
            worst_day = None
            best_total = -1
            worst_total = float("inf")
            sparklines = {k: [] for k in ACTIVITY_FIELDS}
            for dkey, dvals in daily_values:
                day_total = sum(dvals.get(k, 0) for k in ACTIVITY_FIELDS if not activity_types or k in activity_types)
                if day_total > best_total:
                    best_total = day_total
                    best_day = dkey
                if day_total < worst_total:
                    worst_total = day_total
                    worst_day = dkey
                for k in ACTIVITY_FIELDS:
                    sparklines[k].append({"date": dkey, "value": dvals.get(k, 0)})

            entry["best_day"] = {"date": best_day, "total": best_total}
            entry["worst_day"] = {"date": worst_day, "total": worst_total}
            entry["sparklines"] = sparklines
            table_data.append(entry)

    team_total = {k: 0 for k in ACTIVITY_FIELDS}
    team_total_activity = 0
    for td in table_data:
        for key in ACTIVITY_FIELDS:
            if is_single_day:
                val = td.get(key)
            else:
                val = td.get(f"total_{key}")
            if val is not None:
                team_total[key] += val
                team_total_activity += val

    persons_list = [
        {
            "id": p.id,
            "full_name": p.full_name,
            "short_name": p.short_name,
            "color": PERSON_COLORS.get(p.short_name, "#666"),
        }
        for p in all_persons
    ]

    return {
        "persons": persons_list,
        "summary_cards": summary_cards,
        "table_data": table_data,
        "team_total": team_total,
        "team_total_activity": team_total_activity,
        "targets": targets,
        "is_single_day": is_single_day,
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "prev_from": prev_from.isoformat(),
        "prev_to": prev_to.isoformat(),
    }


DRILLDOWN_CONFIG = {
    "connections": {
        "model": LinkedinConnection,
        "date_col": "activity_date",
        "columns": [
            {"key": "activity_date", "label": "Date"},
            {"key": "client_linkedin_url", "label": "LinkedIn URL"},
            {"key": "linkedin_account_used", "label": "Account Used"},
            {"key": "connection_message", "label": "Connection Message"},
            {"key": "cadence_sequence", "label": "Cadence"},
            {"key": "geography", "label": "Geography"},
            {"key": "industry", "label": "Industry"},
        ],
    },
    "followups": {
        "model": LinkedinFollowup,
        "date_col": "activity_date",
        "columns": [
            {"key": "activity_date", "label": "Date"},
            {"key": "client_linkedin_url", "label": "LinkedIn URL"},
            {"key": "linkedin_account_used", "label": "Account Used"},
            {"key": "follow_up_type", "label": "Follow Up Type"},
            {"key": "message_sent", "label": "Message Sent"},
            {"key": "cadence", "label": "Cadence"},
        ],
    },
    "inmails": {
        "model": LinkedinInmail,
        "date_col": "activity_date",
        "columns": [
            {"key": "activity_date", "label": "Date"},
            {"key": "client_linkedin_url", "label": "LinkedIn URL"},
            {"key": "linkedin_account_used", "label": "Account Used"},
            {"key": "inmail_message_sent", "label": "InMail Message"},
            {"key": "geography", "label": "Geography"},
            {"key": "industry", "label": "Industry"},
        ],
    },
    "emails": {
        "model": Email,
        "date_col": "activity_date",
        "columns": [
            {"key": "activity_date", "label": "Date"},
            {"key": "client_name", "label": "Client Name"},
            {"key": "client_email", "label": "Client Email"},
            {"key": "company_name", "label": "Company"},
            {"key": "email_content_sent", "label": "Email Content"},
            {"key": "cadence", "label": "Cadence"},
        ],
    },
    "data_extraction": {
        "model": DataExtractionRecord,
        "date_col": "activity_date",
        "columns": [
            {"key": "activity_date", "label": "Date"},
            {"key": "prospect_name", "label": "Prospect Name"},
            {"key": "prospect_company", "label": "Company"},
            {"key": "client_email", "label": "Email"},
            {"key": "client_linkedin_url", "label": "LinkedIn URL"},
            {"key": "source_of_data", "label": "Source"},
        ],
    },
    "positive_responses": {
        "model": PositiveResponse,
        "date_col": "response_date",
        "columns": [
            {"key": "response_date", "label": "Date"},
            {"key": "client_name", "label": "Client Name"},
            {"key": "client_linkedin_id", "label": "LinkedIn ID"},
            {"key": "response_quality", "label": "Quality"},
            {"key": "chat_summary", "label": "Chat Summary"},
            {"key": "source", "label": "Source"},
        ],
    },
    "leads": {
        "model": LeadGenerated,
        "date_col": "inquiry_date",
        "columns": [
            {"key": "inquiry_date", "label": "Date"},
            {"key": "client_name", "label": "Client Name"},
            {"key": "company_name", "label": "Company"},
            {"key": "client_location", "label": "Location"},
            {"key": "client_linkedin_url", "label": "LinkedIn URL"},
            {"key": "current_status", "label": "Status"},
        ],
    },
}


@router.get("/daily-activity/drill-down")
def get_drill_down(
    person_id: int = Query(...),
    date: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query("connections"),
    page: int = Query(1),
    limit: int = Query(50),
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    today = datetime.now().date()
    d_from = _parse_date(date_from) or _parse_date(date) or today
    d_to = _parse_date(date_to) or _parse_date(date) or today

    if type not in DRILLDOWN_CONFIG:
        return {"error": f"Unknown type: {type}", "records": [], "total": 0, "columns": []}

    cfg = DRILLDOWN_CONFIG[type]
    Model = cfg["model"]
    date_col_name = cfg["date_col"]
    date_col = getattr(Model, date_col_name)

    base = db.query(Model).filter(
        Model.person_id == person_id,
        date_col.isnot(None),
        date_col >= d_from,
        date_col <= d_to,
    )

    if search:
        search_filter = None
        for col_def in cfg["columns"]:
            col = getattr(Model, col_def["key"], None)
            if col is not None and col_def["key"] != date_col_name:
                f = col.ilike(f"%{search}%")
                search_filter = f if search_filter is None else (search_filter | f)
        if search_filter is not None:
            base = base.filter(search_filter)

    total = base.count()
    offset = (page - 1) * limit
    results = base.order_by(date_col.desc()).offset(offset).limit(limit).all()

    records = []
    for r in results:
        row = {}
        for col_def in cfg["columns"]:
            val = getattr(r, col_def["key"], None)
            if isinstance(val, date):
                val = val.isoformat()
            row[col_def["key"]] = val or ""
        records.append(row)

    person = db.query(Person).filter(Person.id == person_id).first()

    return {
        "records": records,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "columns": cfg["columns"],
        "person_name": (person.short_name or person.full_name) if person else "",
        "type": type,
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
    }


@router.get("/daily-activity/export")
def export_drill_down(
    person_id: int = Query(...),
    date: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query("connections"),
    format: str = Query("csv"),
    db: Session = Depends(get_db),
):
    today = datetime.now().date()
    d_from = _parse_date(date_from) or _parse_date(date) or today
    d_to = _parse_date(date_to) or _parse_date(date) or today

    if type not in DRILLDOWN_CONFIG:
        return {"error": f"Unknown type: {type}"}

    cfg = DRILLDOWN_CONFIG[type]
    Model = cfg["model"]
    date_col = getattr(Model, cfg["date_col"])

    results = db.query(Model).filter(
        Model.person_id == person_id,
        date_col.isnot(None),
        date_col >= d_from,
        date_col <= d_to,
    ).order_by(date_col.desc()).all()

    person = db.query(Person).filter(Person.id == person_id).first()
    person_name = (person.short_name or person.full_name) if person else "unknown"

    output = io.StringIO()
    writer = csv.writer(output)
    headers = [c["label"] for c in cfg["columns"]]
    writer.writerow(headers)
    for r in results:
        row = []
        for col_def in cfg["columns"]:
            val = getattr(r, col_def["key"], None)
            if isinstance(val, date):
                val = val.isoformat()
            row.append(val or "")
        writer.writerow(row)

    output.seek(0)
    filename = f"{person_name}_{type}_{d_from}_{d_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/daily-activity/targets")
def get_targets(db: Session = Depends(get_db)):
    t = db.query(DailyTarget).first()
    if not t:
        return DEFAULT_TARGETS
    return {
        "target_connections": t.target_connections,
        "target_followups": t.target_followups,
        "target_inmails": t.target_inmails,
        "target_emails": t.target_emails,
        "target_data_extraction": t.target_data_extraction,
        "target_positive_responses": t.target_positive_responses,
        "target_leads": t.target_leads,
    }


@router.post("/daily-activity/targets")
def update_targets(body: dict, db: Session = Depends(get_db)):
    t = db.query(DailyTarget).first()
    if not t:
        t = DailyTarget(**DEFAULT_TARGETS, updated_at=datetime.now())
        db.add(t)

    for key in DEFAULT_TARGETS:
        if key in body:
            setattr(t, key, int(body[key]))
    t.updated_at = datetime.now()
    db.commit()
    return {"status": "ok", "message": "Targets updated"}


@router.get("/persons")
def get_persons(db: Session = Depends(get_db)):
    persons = db.query(Person).order_by(Person.full_name).all()
    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "short_name": p.short_name,
            "email": p.email,
            "role": p.role or "Lead Gen Executive",
            "color": PERSON_COLORS.get(p.short_name, "#666"),
        }
        for p in persons
    ]
