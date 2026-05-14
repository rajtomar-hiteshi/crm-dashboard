import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    TargetTracking, Person, LinkedinConnection, LinkedinFollowup,
    LinkedinInmail, Email, PositiveResponse, LeadGenerated,
)
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


def _base_query(db, employee, start_date, end_date):
    base = db.query(TargetTracking, Person.short_name)\
        .join(Person, TargetTracking.person_id == Person.id)\
        .filter(TargetTracking.activity_date.isnot(None))
    return apply_filters(base, TargetTracking.person_id, TargetTracking.activity_date, employee, start_date, end_date, db=db)


def _daily(results, field):
    daily = {}
    for r, name in results:
        d = r.activity_date.isoformat()
        daily[d] = daily.get(d, 0) + safe_int(getattr(r, field))
    return [{"date": d, "value": v} for d, v in sorted(daily.items())]


def _weekly(results, field):
    weekly = {}
    for r, name in results:
        iso = r.activity_date.isocalendar()
        key = f"{iso[0]}-W{iso[1]:02d}"
        monday = r.activity_date - timedelta(days=r.activity_date.weekday())
        if key not in weekly:
            weekly[key] = {"week": key, "start_date": monday.isoformat(), "value": 0}
        weekly[key]["value"] += safe_int(getattr(r, field))
    return sorted(weekly.values(), key=lambda x: x["week"])


def _monthly(results, field):
    monthly = {}
    for r, name in results:
        m = r.activity_date.strftime("%Y-%m")
        monthly[m] = monthly.get(m, 0) + safe_int(getattr(r, field))
    return [{"month": m, "value": v} for m, v in sorted(monthly.items())]


def _by_employee(results, field):
    emp = {}
    for r, name in results:
        if name not in emp:
            emp[name] = {"value": 0, "days": set()}
        emp[name]["value"] += safe_int(getattr(r, field))
        emp[name]["days"].add(r.activity_date)
    total = sum(e["value"] for e in emp.values()) or 1
    return [
        {
            "employee": name,
            "value": d["value"],
            "pct": round(d["value"] / total * 100, 1),
            "active_days": len(d["days"]),
            "avg_daily": round(d["value"] / max(len(d["days"]), 1), 1),
            "color": PERSON_COLORS.get(name, "#666"),
        }
        for name, d in sorted(emp.items(), key=lambda x: -x[1]["value"])
    ]


def _emp_daily(results, field):
    daily = {}
    for r, name in results:
        d = r.activity_date.isoformat()
        if d not in daily:
            daily[d] = {"date": d}
        daily[d][name] = daily[d].get(name, 0) + safe_int(getattr(r, field))
    return sorted(daily.values(), key=lambda x: x["date"])


def _summary(results, field, label):
    total = sum(safe_int(getattr(r, field)) for r, _ in results)
    dates = set()
    peak_val = 0
    peak_date = None
    daily = {}
    for r, name in results:
        d = r.activity_date
        dates.add(d)
        v = safe_int(getattr(r, field))
        daily[d] = daily.get(d, 0) + v
    for d, v in daily.items():
        if v > peak_val:
            peak_val = v
            peak_date = d
    return {
        "total": total,
        "active_days": len(dates),
        "avg_daily": round(total / max(len(dates), 1), 1),
        "peak_day": {"date": peak_date.isoformat() if peak_date else None, "value": peak_val},
    }


def _detail_table_drilldown(db, model, date_col_attr, employee, start_date, end_date, person_map):
    date_col = getattr(model, date_col_attr)
    base = db.query(model, Person.short_name)\
        .join(Person, model.person_id == Person.id)
    base = apply_filters(base, model.person_id, date_col, employee, start_date, end_date, db=db)
    records = base.all()
    total = len(records)

    by_emp = {}
    monthly = {}
    daily = {}
    for r, name in records:
        by_emp[name] = by_emp.get(name, 0) + 1
        d = getattr(r, date_col_attr)
        if d:
            m = d.strftime("%Y-%m")
            monthly[m] = monthly.get(m, 0) + 1
            dk = d.isoformat()
            daily[dk] = daily.get(dk, 0) + 1

    total_val = total or 1
    by_employee = [
        {
            "employee": name, "value": cnt,
            "pct": round(cnt / total_val * 100, 1),
            "active_days": 0, "avg_daily": 0,
            "color": PERSON_COLORS.get(name, "#666"),
        }
        for name, cnt in sorted(by_emp.items(), key=lambda x: -x[1])
    ]

    peak_date = max(daily, key=daily.get) if daily else None
    peak_val = daily[peak_date] if peak_date else 0

    return {
        "summary": {
            "total": total,
            "active_days": len(daily),
            "avg_daily": round(total / max(len(daily), 1), 1),
            "peak_day": {"date": peak_date, "value": peak_val},
        },
        "daily": [{"date": d, "value": v} for d, v in sorted(daily.items())],
        "weekly": [],
        "monthly": [{"month": m, "value": v} for m, v in sorted(monthly.items())],
        "by_employee": by_employee,
        "employee_daily": [],
    }


@router.get("/drilldown/{metric}")
def get_drilldown(
    metric: str,
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
):
    METRIC_MAP = {
        "connections": ("linkedin_connections", "LinkedIn Connections"),
        "followups": ("linkedin_follow_ups", "Follow-Ups"),
        "inmails": ("linkedin_inmails", "InMails Sent"),
        "emails": ("emails", "Email Outreach"),
    }

    person_map = {p.id: (p.short_name or p.full_name) for p in db.query(Person).all()}

    if metric == "response_rate":
        return _drilldown_response_rate(db, employee, start_date, end_date, person_map)

    if metric == "positive_responses":
        dd = _detail_table_drilldown(db, PositiveResponse, "response_date", employee, start_date, end_date, person_map)
        recent = _get_recent(db, metric, employee, start_date, end_date)
        return {"metric": metric, "title": "Positive Responses", **dd, "recent": recent}

    if metric == "leads":
        dd = _detail_table_drilldown(db, LeadGenerated, "inquiry_date", employee, start_date, end_date, person_map)
        recent = _get_recent(db, metric, employee, start_date, end_date)
        return {"metric": metric, "title": "Leads Generated", **dd, "recent": recent}

    if metric not in METRIC_MAP:
        return {"error": f"Unknown metric: {metric}"}

    field, title = METRIC_MAP[metric]
    base = _base_query(db, employee, start_date, end_date)
    results = base.order_by(TargetTracking.activity_date).all()

    if not results:
        return {
            "metric": metric, "title": title,
            "summary": {"total": 0, "active_days": 0, "avg_daily": 0, "peak_day": {"date": None, "value": 0}},
            "daily": [], "weekly": [], "monthly": [],
            "by_employee": [], "employee_daily": [], "recent": [],
        }

    recent = _get_recent(db, metric, employee, start_date, end_date)

    return {
        "metric": metric,
        "title": title,
        "summary": _summary(results, field, title),
        "daily": _daily(results, field),
        "weekly": _weekly(results, field),
        "monthly": _monthly(results, field),
        "by_employee": _by_employee(results, field),
        "employee_daily": _emp_daily(results, field),
        "recent": recent,
    }


def _drilldown_response_rate(db, employee, start_date, end_date, person_map):
    base = _base_query(db, employee, start_date, end_date)
    results = base.order_by(TargetTracking.activity_date).all()

    pr_q = db.query(PositiveResponse.person_id, PositiveResponse.response_date)
    pr_q = apply_filters(pr_q, PositiveResponse.person_id, PositiveResponse.response_date, employee, start_date, end_date, db=db)
    pr_records = pr_q.all()

    pr_monthly = {}
    pr_by_pid = {}
    for pid, rdate in pr_records:
        pr_by_pid[pid] = pr_by_pid.get(pid, 0) + 1
        if rdate:
            m = rdate.strftime("%Y-%m")
            pr_monthly[m] = pr_monthly.get(m, 0) + 1

    conn_monthly = {}
    conn_by_name = {}
    pid_to_name = {}
    for r, name in results:
        m = r.activity_date.strftime("%Y-%m")
        conn_monthly[m] = conn_monthly.get(m, 0) + safe_int(r.linkedin_connections)
        if name not in conn_by_name:
            conn_by_name[name] = {"connections": 0, "pid": r.person_id}
        conn_by_name[name]["connections"] += safe_int(r.linkedin_connections)
        pid_to_name[r.person_id] = name

    trend = []
    for m in sorted(set(conn_monthly.keys()) | set(pr_monthly.keys())):
        resp = pr_monthly.get(m, 0)
        conn = conn_monthly.get(m, 0)
        rate = round(resp / max(conn, 1) * 100, 2)
        trend.append({"month": m, "value": rate, "responses": resp, "connections": conn})

    by_emp = []
    for name, d in sorted(conn_by_name.items(), key=lambda x: -pr_by_pid.get(x[1]["pid"], 0)):
        resp = pr_by_pid.get(d["pid"], 0)
        conn = d["connections"]
        by_emp.append({
            "employee": name,
            "value": round(resp / max(conn, 1) * 100, 2),
            "responses": resp,
            "connections": conn,
            "color": PERSON_COLORS.get(name, "#666"),
        })

    total_resp = len(pr_records)
    total_conn = sum(d["connections"] for d in conn_by_name.values())

    return {
        "metric": "response_rate",
        "title": "Response Rate",
        "summary": {
            "total": round(total_resp / max(total_conn, 1) * 100, 2),
            "total_responses": total_resp,
            "total_connections": total_conn,
            "active_days": 0,
            "avg_daily": 0,
            "peak_day": {"date": None, "value": 0},
        },
        "daily": [],
        "weekly": [],
        "monthly": trend,
        "by_employee": by_emp,
        "employee_daily": [],
        "recent": [],
    }


def _get_recent(db, metric, employee, start_date, end_date):
    if metric == "connections":
        base = db.query(LinkedinConnection, Person.short_name)\
            .join(Person, LinkedinConnection.person_id == Person.id)
        base = apply_filters(base, LinkedinConnection.person_id, LinkedinConnection.activity_date, employee, start_date, end_date, db=db)
        rows = base.order_by(LinkedinConnection.activity_date.desc()).limit(50).all()
        return [
            {
                "date": r.activity_date.isoformat() if r.activity_date else "",
                "employee": name,
                "detail": r.client_linkedin_url or "",
                "extra": r.geography or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    if metric == "followups":
        base = db.query(LinkedinFollowup, Person.short_name)\
            .join(Person, LinkedinFollowup.person_id == Person.id)
        base = apply_filters(base, LinkedinFollowup.person_id, LinkedinFollowup.activity_date, employee, start_date, end_date, db=db)
        rows = base.order_by(LinkedinFollowup.activity_date.desc()).limit(50).all()
        return [
            {
                "date": r.activity_date.isoformat() if r.activity_date else "",
                "employee": name,
                "detail": r.follow_up_type or "",
                "extra": r.message_sent or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    if metric == "inmails":
        base = db.query(LinkedinInmail, Person.short_name)\
            .join(Person, LinkedinInmail.person_id == Person.id)
        base = apply_filters(base, LinkedinInmail.person_id, LinkedinInmail.activity_date, employee, start_date, end_date, db=db)
        rows = base.order_by(LinkedinInmail.activity_date.desc()).limit(50).all()
        return [
            {
                "date": r.activity_date.isoformat() if r.activity_date else "",
                "employee": name,
                "detail": r.inmail_message_sent or "",
                "extra": r.geography or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    if metric == "positive_responses":
        base = db.query(PositiveResponse, Person.short_name)\
            .join(Person, PositiveResponse.person_id == Person.id)
        base = apply_filters(base, PositiveResponse.person_id, PositiveResponse.response_date, employee, start_date, end_date, db=db)
        rows = base.order_by(PositiveResponse.response_date.desc()).limit(50).all()
        return [
            {
                "date": r.response_date.isoformat() if r.response_date else "",
                "employee": name,
                "detail": r.client_name or "",
                "extra": r.response_quality or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    if metric == "leads":
        base = db.query(LeadGenerated, Person.short_name)\
            .join(Person, LeadGenerated.person_id == Person.id)
        base = apply_filters(base, LeadGenerated.person_id, LeadGenerated.inquiry_date, employee, start_date, end_date, db=db)
        rows = base.order_by(LeadGenerated.inquiry_date.desc()).limit(50).all()
        return [
            {
                "date": r.inquiry_date.isoformat() if r.inquiry_date else "",
                "employee": name,
                "detail": r.client_name or "",
                "extra": r.company_name or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    if metric == "emails":
        base = db.query(Email, Person.short_name)\
            .join(Person, Email.person_id == Person.id)
        base = apply_filters(base, Email.person_id, Email.activity_date, employee, start_date, end_date, db=db)
        rows = base.order_by(Email.activity_date.desc()).limit(50).all()
        return [
            {
                "date": r.activity_date.isoformat() if r.activity_date else "",
                "employee": name,
                "detail": r.client_name or "",
                "extra": r.client_email or "",
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for r, name in rows
        ]

    return []
