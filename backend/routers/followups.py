import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/followups")
def get_followups(
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
):
    base = db.query(TargetTracking, Person.short_name)\
        .join(Person, TargetTracking.person_id == Person.id)\
        .filter(TargetTracking.activity_date.isnot(None))
    base = apply_filters(base, Person.short_name, TargetTracking.activity_date, employee, start_date, end_date)
    results = base.all()
    logger.info(f"Followups: {len(results)} rows")

    if not results:
        return {
            "kpis": {"total": 0, "best_fu_rate": 0, "highest_daily_avg": 0, "team_fu_conn_ratio": 0},
            "by_employee": [], "monthly_trend": [], "daily_stacked": [], "metrics_table": [],
        }

    total_fu = sum(safe_int(r.linkedin_follow_ups) for r, _ in results)
    total_conn = sum(safe_int(r.linkedin_connections) for r, _ in results)
    team_ratio = round(total_fu / max(total_conn, 1) * 100, 2)

    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"fu": 0, "conn": 0, "days": set(), "peak": 0}
        fu = safe_int(r.linkedin_follow_ups)
        emp_data[name]["fu"] += fu
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)
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
        {"employee": name, "follow_ups": d["fu"], "color": PERSON_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    monthly = {}
    for r, name in results:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "follow_ups": 0}
        monthly[key]["follow_ups"] += safe_int(r.linkedin_follow_ups)
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    daily = {}
    for r, name in results:
        key = r.activity_date.isoformat()
        if key not in daily:
            daily[key] = {"date": key}
        daily[key][name] = safe_int(r.linkedin_follow_ups)
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
            "share_pct": share_pct, "color": PERSON_COLORS.get(name, "#666"),
        })

    return {
        "kpis": kpis, "by_employee": by_employee, "monthly_trend": monthly_trend,
        "daily_stacked": daily_stacked, "metrics_table": metrics_table,
    }
