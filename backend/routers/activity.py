import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/activity")
def get_activity(
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
    rows = base.order_by(DailyActivity.activity_date).all()
    logger.info(f"Activity: {len(rows)} rows")

    if not rows:
        return {
            "daily_volume": [], "monthly_breakdown": [],
            "daily_averages": [], "summary_table": [],
        }

    daily_map = {}
    for r in rows:
        key = r.activity_date.isoformat()
        if key not in daily_map:
            daily_map[key] = {"date": key, "connections": 0, "follow_ups": 0, "inmails": 0}
        daily_map[key]["connections"] += r.linkedin_connections or 0
        daily_map[key]["follow_ups"] += r.linkedin_follow_ups or 0
        daily_map[key]["inmails"] += r.linkedin_inmails or 0
    daily_volume = sorted(daily_map.values(), key=lambda x: x["date"])

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
        monthly[key]["connections"] += r.linkedin_connections or 0
        monthly[key]["follow_ups"] += r.linkedin_follow_ups or 0
        monthly[key]["inmails"] += r.linkedin_inmails or 0
        monthly[key]["leads"] += r.lead_generated or 0
    monthly_breakdown = sorted(monthly.values(), key=lambda x: x["month"])

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"conn": 0, "fu": 0, "im": 0, "leads": 0, "dates": set()}
        emp_data[name]["conn"] += r.linkedin_connections or 0
        emp_data[name]["fu"] += r.linkedin_follow_ups or 0
        emp_data[name]["im"] += r.linkedin_inmails or 0
        emp_data[name]["leads"] += r.lead_generated or 0
        emp_data[name]["dates"].add(r.activity_date)

    daily_averages = [
        {
            "employee": name,
            "avg_connections": round(d["conn"] / max(len(d["dates"]), 1), 1),
            "avg_follow_ups": round(d["fu"] / max(len(d["dates"]), 1), 1),
            "color": EMPLOYEE_COLORS.get(name, "#666"),
        }
        for name, d in emp_data.items()
    ]

    summary_table = []
    for name, d in emp_data.items():
        active = len(d["dates"])
        total_actions = d["conn"] + d["fu"] + d["im"]
        efficiency = round(d["leads"] / max(total_actions, 1) * 100, 2)
        summary_table.append({
            "employee": name,
            "active_days": active,
            "total_connections": d["conn"],
            "total_follow_ups": d["fu"],
            "inmails": d["im"],
            "leads": d["leads"],
            "avg_conn_per_day": round(d["conn"] / max(active, 1), 1),
            "efficiency": efficiency,
            "color": EMPLOYEE_COLORS.get(name, "#666"),
        })

    return {
        "daily_volume": daily_volume,
        "monthly_breakdown": monthly_breakdown,
        "daily_averages": daily_averages,
        "summary_table": summary_table,
    }
