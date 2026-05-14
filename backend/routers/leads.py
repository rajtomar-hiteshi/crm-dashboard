import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person, LeadGenerated
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/leads")
def get_leads(
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
    logger.info(f"Leads: {len(results)} rows from target_tracking")

    lead_base = db.query(LeadGenerated, Person.short_name)\
        .join(Person, LeadGenerated.person_id == Person.id)
    lead_base = apply_filters(lead_base, Person.short_name, LeadGenerated.inquiry_date, employee, start_date, end_date)
    pipeline_results = lead_base.order_by(LeadGenerated.inquiry_date.desc()).all()
    has_pipeline_data = len(pipeline_results) > 0
    logger.info(f"Leads: {len(pipeline_results)} pipeline records")

    if not results and not has_pipeline_data:
        return {
            "kpis": {"total_leads": 0, "conversion_rate": 0, "unique_geographies": 0, "top_generator": "N/A"},
            "by_employee": [], "geography": [], "monthly_trend": [],
            "conversion_by_employee": [], "all_leads": [], "has_pipeline_data": False,
        }

    # Build base emp_data from target_tracking (connections, positive_responses)
    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"leads": 0, "conn": 0, "pr": 0}
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)
        emp_data[name]["pr"] += safe_int(r.positive_responses)

    # Use pipeline (leads_generated table) for lead counts when available,
    # otherwise fall back to target_tracking.leads_generated text sums
    if has_pipeline_data:
        pipeline_emp_counts = {}
        for lead, name in pipeline_results:
            pipeline_emp_counts[name] = pipeline_emp_counts.get(name, 0) + 1
        for name in emp_data:
            emp_data[name]["leads"] = pipeline_emp_counts.get(name, 0)
        # Include employees who appear in pipeline but not in target_tracking
        for name, count in pipeline_emp_counts.items():
            if name not in emp_data:
                emp_data[name] = {"leads": count, "conn": 0, "pr": 0}
        total_leads = sum(pipeline_emp_counts.values())
    else:
        for r, name in results:
            emp_data[name]["leads"] += safe_int(r.leads_generated)
        total_leads = sum(d["leads"] for d in emp_data.values())

    total_conn = sum(d["conn"] for d in emp_data.values())
    conversion_rate = round(total_leads / max(total_conn, 1) * 100, 2)

    top_gen = max(emp_data, key=lambda k: emp_data[k]["leads"]) if emp_data else "N/A"

    locations = set()
    for lead, _ in pipeline_results:
        if lead.client_location:
            locations.add(lead.client_location)

    kpis = {
        "total_leads": total_leads,
        "conversion_rate": conversion_rate,
        "unique_geographies": len(locations),
        "top_generator": top_gen,
    }

    by_employee = [
        {"employee": name, "leads": d["leads"], "color": PERSON_COLORS.get(name, "#666")}
        for name, d in emp_data.items()
    ]

    geo_counts = {}
    for lead, _ in pipeline_results:
        loc = lead.client_location or "Unknown"
        geo_counts[loc] = geo_counts.get(loc, 0) + 1
    geo_colors = ["#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#F97316"]
    geography = [
        {"location": loc, "count": cnt, "color": geo_colors[i % len(geo_colors)]}
        for i, (loc, cnt) in enumerate(sorted(geo_counts.items(), key=lambda x: -x[1]))
    ]

    monthly = {}
    if has_pipeline_data:
        # Use pipeline records for lead counts in monthly trend
        for lead, name in pipeline_results:
            if lead.inquiry_date:
                key = lead.inquiry_date.strftime("%Y-%m")
                if key not in monthly:
                    monthly[key] = {"month": key, "leads": 0, "positive_responses": 0}
                monthly[key]["leads"] += 1
        # Merge positive_responses from target_tracking
        for r, name in results:
            key = r.activity_date.strftime("%Y-%m")
            if key not in monthly:
                monthly[key] = {"month": key, "leads": 0, "positive_responses": 0}
            monthly[key]["positive_responses"] += safe_int(r.positive_responses)
    else:
        for r, name in results:
            key = r.activity_date.strftime("%Y-%m")
            if key not in monthly:
                monthly[key] = {"month": key, "leads": 0, "positive_responses": 0}
            monthly[key]["leads"] += safe_int(r.leads_generated)
            monthly[key]["positive_responses"] += safe_int(r.positive_responses)
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    conversion_by_employee = [
        {
            "employee": name, "leads": d["leads"],
            "conversion_rate": round(d["leads"] / max(d["conn"], 1) * 100, 2),
            "color": PERSON_COLORS.get(name, "#666"),
        }
        for name, d in emp_data.items()
    ]

    all_leads = [
        {
            "date": lead.inquiry_date.isoformat() if lead.inquiry_date else "",
            "client_name": lead.client_name or "",
            "company": lead.company_name or "",
            "location": lead.client_location or "",
            "employee": name,
            "color": PERSON_COLORS.get(name, "#666"),
        }
        for lead, name in pipeline_results
    ]

    return {
        "kpis": kpis, "by_employee": by_employee, "geography": geography,
        "monthly_trend": monthly_trend, "conversion_by_employee": conversion_by_employee,
        "all_leads": all_leads, "has_pipeline_data": has_pipeline_data,
    }
