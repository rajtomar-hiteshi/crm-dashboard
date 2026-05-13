import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/inmails")
def get_inmails(
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
):
    base = apply_filters(
        db.query(DailyActivity),
        DailyActivity.employee_name, DailyActivity.activity_date,
        employee, start_date, end_date,
    )
    rows = base.all()
    logger.info(f"InMails: {len(rows)} rows")

    if not rows:
        return {
            "kpis": {"total": 0, "top_inmailer": "N/A", "highest_daily_avg": 0, "avg_im_conn_ratio": 0},
            "distribution": [], "monthly_volume": [], "metrics_table": [],
        }

    total_im = sum(r.linkedin_inmails or 0 for r in rows)
    total_conn = sum(r.linkedin_connections or 0 for r in rows)
    avg_ratio = round(total_im / max(total_conn, 1) * 100, 2)

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"im": 0, "conn": 0, "days": set(), "active_days": 0, "peak": 0}
        im = r.linkedin_inmails or 0
        emp_data[name]["im"] += im
        emp_data[name]["conn"] += r.linkedin_connections or 0
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
        {"employee": name, "inmails": d["im"], "color": EMPLOYEE_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key}
        emp_key = r.employee_name
        monthly[key][emp_key] = monthly[key].get(emp_key, 0) + (r.linkedin_inmails or 0)
    monthly_volume = sorted(monthly.values(), key=lambda x: x["month"])

    metrics_table = []
    for name, d in emp_data.items():
        avg_active = round(d["im"] / max(d["active_days"], 1), 1)
        im_conn = round(d["im"] / max(d["conn"], 1) * 100, 2)
        share_pct = round(d["im"] / max(total_im, 1) * 100, 1)
        metrics_table.append({
            "employee": name, "total": d["im"], "avg_per_active_day": avg_active,
            "peak_day": d["peak"], "im_conn_ratio": im_conn,
            "share_pct": share_pct, "color": EMPLOYEE_COLORS.get(name, "#666"),
        })

    return {
        "kpis": kpis, "distribution": distribution,
        "monthly_volume": monthly_volume, "metrics_table": metrics_table,
    }
