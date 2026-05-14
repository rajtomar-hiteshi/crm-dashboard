import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/inmails")
def get_inmails(
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    period: str = Query(None),
    db: Session = Depends(get_db),
):
    fkw = dict(employee=employee, start_date=start_date, end_date=end_date, period=period)
    base = db.query(TargetTracking, Person.short_name)\
        .join(Person, TargetTracking.person_id == Person.id)\
        .filter(TargetTracking.activity_date.isnot(None))
    base = apply_filters(base, TargetTracking.person_id, TargetTracking.activity_date, **fkw)
    results = base.all()
    logger.info(f"InMails: {len(results)} rows")

    if not results:
        return {
            "kpis": {"total": 0, "top_inmailer": "N/A", "highest_daily_avg": 0, "avg_im_conn_ratio": 0},
            "distribution": [], "monthly_volume": [], "metrics_table": [],
        }

    total_im = sum(safe_int(r.linkedin_inmails) for r, _ in results)
    total_conn = sum(safe_int(r.linkedin_connections) for r, _ in results)
    avg_ratio = round(total_im / max(total_conn, 1) * 100, 2)

    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"im": 0, "conn": 0, "days": set(), "active_days": 0, "peak": 0}
        im = safe_int(r.linkedin_inmails)
        emp_data[name]["im"] += im
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)
        emp_data[name]["days"].add(r.activity_date)
        if im > 0:
            emp_data[name]["active_days"] += 1
        emp_data[name]["peak"] = max(emp_data[name]["peak"], im)

    top_inmailer = max(emp_data, key=lambda k: emp_data[k]["im"])
    highest_avg_emp = max(emp_data, key=lambda k: emp_data[k]["im"] / max(emp_data[k]["active_days"], 1))
    highest_avg = round(emp_data[highest_avg_emp]["im"] / max(emp_data[highest_avg_emp]["active_days"], 1), 1)

    kpis = {
        "total": total_im, "top_inmailer": top_inmailer,
        "highest_daily_avg": highest_avg, "avg_im_conn_ratio": avg_ratio,
    }

    distribution = [
        {"employee": name, "inmails": d["im"], "color": PERSON_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    monthly = {}
    for r, name in results:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key}
        monthly[key][name] = monthly[key].get(name, 0) + safe_int(r.linkedin_inmails)
    monthly_volume = sorted(monthly.values(), key=lambda x: x["month"])

    metrics_table = []
    for name, d in emp_data.items():
        avg_active = round(d["im"] / max(d["active_days"], 1), 1)
        im_conn = round(d["im"] / max(d["conn"], 1) * 100, 2)
        share_pct = round(d["im"] / max(total_im, 1) * 100, 1)
        metrics_table.append({
            "employee": name, "total": d["im"], "avg_per_active_day": avg_active,
            "peak_day": d["peak"], "im_conn_ratio": im_conn,
            "share_pct": share_pct, "color": PERSON_COLORS.get(name, "#666"),
        })

    return {
        "kpis": kpis, "distribution": distribution,
        "monthly_volume": monthly_volume, "metrics_table": metrics_table,
    }
