import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/followups")
def get_followups(
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
    logger.info(f"Followups: {len(rows)} rows")

    if not rows:
        return {
            "kpis": {"total": 0, "best_fu_rate": 0, "highest_daily_avg": 0, "team_fu_conn_ratio": 0},
            "by_employee": [], "monthly_trend": [], "daily_stacked": [], "metrics_table": [],
        }

    total_fu = sum(r.linkedin_follow_ups or 0 for r in rows)
    total_conn = sum(r.linkedin_connections or 0 for r in rows)
    team_ratio = round(total_fu / max(total_conn, 1) * 100, 2)

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"fu": 0, "conn": 0, "days": set(), "peak": 0}
        fu = r.linkedin_follow_ups or 0
        emp_data[name]["fu"] += fu
        emp_data[name]["conn"] += r.linkedin_connections or 0
        emp_data[name]["days"].add(r.activity_date)
        emp_data[name]["peak"] = max(emp_data[name]["peak"], fu)

    best_rate_emp = max(emp_data, key=lambda k: emp_data[k]["fu"] / max(emp_data[k]["conn"], 1))
    best_rate = round(emp_data[best_rate_emp]["fu"] / max(emp_data[best_rate_emp]["conn"], 1) * 100, 2)
    highest_avg_emp = max(emp_data, key=lambda k: emp_data[k]["fu"] / max(len(emp_data[k]["days"]), 1))
    highest_avg = round(emp_data[highest_avg_emp]["fu"] / max(len(emp_data[highest_avg_emp]["days"]), 1), 1)

    kpis = {
        "total": total_fu, "best_fu_rate": best_rate,
        "highest_daily_avg": highest_avg, "team_fu_conn_ratio": team_ratio,
    }

    by_employee = [
        {"employee": name, "follow_ups": d["fu"], "color": EMPLOYEE_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "follow_ups": 0}
        monthly[key]["follow_ups"] += r.linkedin_follow_ups or 0
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    daily = {}
    for r in rows:
        key = r.activity_date.isoformat()
        if key not in daily:
            daily[key] = {"date": key}
        daily[key][r.employee_name] = r.linkedin_follow_ups or 0
    daily_stacked = sorted(daily.values(), key=lambda x: x["date"])

    metrics_table = []
    for name, d in emp_data.items():
        active = len(d["days"])
        avg_per_day = round(d["fu"] / max(active, 1), 1)
        fu_conn = round(d["fu"] / max(d["conn"], 1) * 100, 2)
        share_pct = round(d["fu"] / max(total_fu, 1) * 100, 1)
        metrics_table.append({
            "employee": name, "total": d["fu"], "avg_per_day": avg_per_day,
            "peak_day": d["peak"], "fu_conn_ratio": fu_conn,
            "share_pct": share_pct, "color": EMPLOYEE_COLORS.get(name, "#666"),
        })

    return {
        "kpis": kpis, "by_employee": by_employee, "monthly_trend": monthly_trend,
        "daily_stacked": daily_stacked, "metrics_table": metrics_table,
    }
