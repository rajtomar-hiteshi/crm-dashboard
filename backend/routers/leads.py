import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity, LeadPipeline
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/leads")
def get_leads(
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
    logger.info(f"Leads: {len(rows)} rows from daily_activity")

    lead_query = apply_filters(
        db.query(LeadPipeline),
        LeadPipeline.employee_name, LeadPipeline.lead_date,
        employee, start_date, end_date,
    )
    pipeline_leads = lead_query.order_by(LeadPipeline.lead_date.desc()).all()
    has_pipeline_data = len(pipeline_leads) > 0
    logger.info(f"Leads: {len(pipeline_leads)} pipeline records, has_pipeline={has_pipeline_data}")

    if not rows:
        return {
            "kpis": {"total_leads": 0, "conversion_rate": 0, "unique_geographies": 0, "top_generator": "N/A"},
            "by_employee": [], "geography": [], "monthly_trend": [],
            "conversion_by_employee": [], "all_leads": [], "has_pipeline_data": False,
        }

    total_leads = sum(r.lead_generated or 0 for r in rows)
    total_conn = sum(r.linkedin_connections or 0 for r in rows)
    conversion_rate = round(total_leads / max(total_conn, 1) * 100, 2)

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"leads": 0, "conn": 0, "pr": 0}
        emp_data[name]["leads"] += r.lead_generated or 0
        emp_data[name]["conn"] += r.linkedin_connections or 0
        emp_data[name]["pr"] += r.positive_responses or 0

    top_gen = max(emp_data, key=lambda k: emp_data[k]["leads"]) if emp_data else "N/A"

    locations = set()
    for lead in pipeline_leads:
        if lead.location:
            locations.add(lead.location)

    kpis = {
        "total_leads": total_leads,
        "conversion_rate": conversion_rate,
        "unique_geographies": len(locations),
        "top_generator": top_gen,
    }

    by_employee = [
        {"employee": name, "leads": d["leads"], "color": EMPLOYEE_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    geo_counts = {}
    for lead in pipeline_leads:
        loc = lead.location or "Unknown"
        geo_counts[loc] = geo_counts.get(loc, 0) + 1
    geo_colors = ["#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#F97316"]
    geography = [
        {"location": loc, "count": cnt, "color": geo_colors[i % len(geo_colors)]}
        for i, (loc, cnt) in enumerate(sorted(geo_counts.items(), key=lambda x: -x[1]))
    ]

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "leads": 0, "positive_responses": 0}
        monthly[key]["leads"] += r.lead_generated or 0
        monthly[key]["positive_responses"] += r.positive_responses or 0
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    conversion_by_employee = [
        {
            "employee": name, "leads": d["leads"],
            "conversion_rate": round(d["leads"] / max(d["conn"], 1) * 100, 2),
            "color": EMPLOYEE_COLORS.get(name, "#666"),
        }
        for name, d in emp_data.items()
    ]

    all_leads = [
        {
            "date": lead.lead_date.isoformat() if lead.lead_date else "",
            "client_name": lead.client_name or "",
            "company": lead.company or "",
            "location": lead.location or "",
            "employee": lead.employee_name,
            "color": EMPLOYEE_COLORS.get(lead.employee_name, "#666"),
        }
        for lead in pipeline_leads
    ]

    return {
        "kpis": kpis, "by_employee": by_employee, "geography": geography,
        "monthly_trend": monthly_trend, "conversion_by_employee": conversion_by_employee,
        "all_leads": all_leads, "has_pipeline_data": has_pipeline_data,
    }
