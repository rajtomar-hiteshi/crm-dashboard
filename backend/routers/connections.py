import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/connections")
def get_connections(
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
    logger.info(f"Connections: {len(rows)} rows")

    if not rows:
        return {
            "kpis": {"total": 0, "best_performer": "N/A", "highest_daily_avg": 0, "peak_single_day": 0},
            "by_employee": [], "monthly_trend": [], "daily_stacked": [], "metrics_table": [],
        }

    total = sum(r.linkedin_connections or 0 for r in rows)

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"total": 0, "days": set(), "peak": 0}
        val = r.linkedin_connections or 0
        emp_data[name]["total"] += val
        emp_data[name]["days"].add(r.activity_date)
        emp_data[name]["peak"] = max(emp_data[name]["peak"], val)

    best = max(emp_data, key=lambda k: emp_data[k]["total"])
    highest_avg_emp = max(emp_data, key=lambda k: emp_data[k]["total"] / max(len(emp_data[k]["days"]), 1))
    highest_avg = round(emp_data[highest_avg_emp]["total"] / max(len(emp_data[highest_avg_emp]["days"]), 1), 1)
    peak_single = max(r.linkedin_connections or 0 for r in rows)

    kpis = {
        "total": total,
        "best_performer": best,
        "highest_daily_avg": highest_avg,
        "peak_single_day": peak_single,
    }

    by_employee = [
        {"employee": name, "connections": d["total"], "color": EMPLOYEE_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "connections": 0}
        monthly[key]["connections"] += r.linkedin_connections or 0
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    daily = {}
    for r in rows:
        key = r.activity_date.isoformat()
        if key not in daily:
            daily[key] = {"date": key}
        daily[key][r.employee_name] = r.linkedin_connections or 0
    daily_stacked = sorted(daily.values(), key=lambda x: x["date"])

    metrics_table = []
    for name, d in emp_data.items():
        active = len(d["days"])
        avg_per_day = round(d["total"] / max(active, 1), 1)
        share_pct = round(d["total"] / max(total, 1) * 100, 1)
        metrics_table.append({
            "employee": name, "total": d["total"], "active_days": active,
            "avg_per_day": avg_per_day, "peak_day": d["peak"],
            "share_pct": share_pct, "color": EMPLOYEE_COLORS.get(name, "#666"),
        })

    return {
        "kpis": kpis, "by_employee": by_employee, "monthly_trend": monthly_trend,
        "daily_stacked": daily_stacked, "metrics_table": metrics_table,
    }
