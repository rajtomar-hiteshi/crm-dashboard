import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/activity")
def get_activity(
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
):
    base = db.query(TargetTracking, Person.short_name)\
        .join(Person, TargetTracking.person_id == Person.id)\
        .filter(TargetTracking.activity_date.isnot(None))
    base = apply_filters(base, Person.short_name, TargetTracking.activity_date, employee, start_date, end_date)
    results = base.order_by(TargetTracking.activity_date).all()
    logger.info(f"Activity: {len(results)} rows")

    if not results:
        return {
            "daily_volume": [], "monthly_breakdown": [],
            "daily_averages": [], "summary_table": [],
        }

    daily_map = {}
    for r, name in results:
        key = r.activity_date.isoformat()
        if key not in daily_map:
            daily_map[key] = {"date": key, "connections": 0, "follow_ups": 0, "inmails": 0}
        daily_map[key]["connections"] += safe_int(r.linkedin_connections)
        daily_map[key]["follow_ups"] += safe_int(r.linkedin_follow_ups)
        daily_map[key]["inmails"] += safe_int(r.linkedin_inmails)
    daily_volume = sorted(daily_map.values(), key=lambda x: x["date"])

    monthly = {}
    for r, name in results:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
        monthly[key]["connections"] += safe_int(r.linkedin_connections)
        monthly[key]["follow_ups"] += safe_int(r.linkedin_follow_ups)
        monthly[key]["inmails"] += safe_int(r.linkedin_inmails)
        monthly[key]["leads"] += safe_int(r.leads_generated)
    monthly_breakdown = sorted(monthly.values(), key=lambda x: x["month"])

    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"conn": 0, "fu": 0, "im": 0, "leads": 0, "dates": set()}
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)
        emp_data[name]["fu"] += safe_int(r.linkedin_follow_ups)
        emp_data[name]["im"] += safe_int(r.linkedin_inmails)
        emp_data[name]["leads"] += safe_int(r.leads_generated)
        emp_data[name]["dates"].add(r.activity_date)

    daily_averages = [
        {
            "employee": name,
            "avg_connections": round(d["conn"] / max(len(d["dates"]), 1), 1),
            "avg_follow_ups": round(d["fu"] / max(len(d["dates"]), 1), 1),
            "color": PERSON_COLORS.get(name, "#666"),
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
            "color": PERSON_COLORS.get(name, "#666"),
        })

    return {
        "daily_volume": daily_volume,
        "monthly_breakdown": monthly_breakdown,
        "daily_averages": daily_averages,
        "summary_table": summary_table,
    }
