import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person, PositiveResponse
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/positive-responses")
def get_positive_responses(
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
    logger.info(f"PositiveResponses: {len(results)} rows from target_tracking")

    detail_base = db.query(PositiveResponse, Person.short_name)\
        .join(Person, PositiveResponse.person_id == Person.id)
    detail_base = apply_filters(detail_base, Person.short_name, PositiveResponse.response_date, employee, start_date, end_date)
    detail_results = detail_base.order_by(PositiveResponse.response_date.desc()).all()
    has_detail_data = len(detail_results) > 0
    logger.info(f"PositiveResponses: {len(detail_results)} detail records")

    if not results:
        return {
            "kpis": {"total": 0, "high_quality": 0, "generic_interest": 0,
                     "best_rate_employee": "N/A", "best_rate": 0},
            "by_employee_stacked": [], "quality_distribution": [],
            "monthly_trend": [], "recent_responses": [], "has_detail_data": False,
        }

    total_pr = sum(safe_int(r.positive_responses) for r, _ in results)

    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"pr": 0, "conn": 0}
        emp_data[name]["pr"] += safe_int(r.positive_responses)
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)

    best_rate_emp = "N/A"
    best_rate = 0
    if emp_data:
        best_rate_emp = max(emp_data, key=lambda k: emp_data[k]["pr"] / max(emp_data[k]["conn"], 1))
        best_rate = round(emp_data[best_rate_emp]["pr"] / max(emp_data[best_rate_emp]["conn"], 1) * 100, 2)

    if has_detail_data:
        hq_count = sum(1 for d, _ in detail_results if d.response_quality and "high" in d.response_quality.lower())
        gi_count = sum(1 for d, _ in detail_results if d.response_quality and "generic" in d.response_quality.lower())
        pr_count = total_pr - hq_count - gi_count

        emp_quality = {}
        for d, name in detail_results:
            if name not in emp_quality:
                emp_quality[name] = {"high_quality": 0, "positive_response": 0, "generic_interest": 0}
            q = (d.response_quality or "").lower()
            if "high" in q:
                emp_quality[name]["high_quality"] += 1
            elif "generic" in q:
                emp_quality[name]["generic_interest"] += 1
            else:
                emp_quality[name]["positive_response"] += 1

        by_employee_stacked = []
        for name in set(list(emp_data.keys()) + list(emp_quality.keys())):
            eq = emp_quality.get(name, {"high_quality": 0, "positive_response": 0, "generic_interest": 0})
            by_employee_stacked.append({
                "employee": name, **eq,
                "color": PERSON_COLORS.get(name, "#666"),
            })

        quality_distribution = [
            {"name": "High Quality", "value": hq_count, "color": "#3B82F6"},
            {"name": "Positive Response", "value": max(pr_count, 0), "color": "#10B981"},
            {"name": "Generic Interest", "value": gi_count, "color": "#F59E0B"},
        ]

        recent_responses = [
            {
                "date": d.response_date.isoformat() if d.response_date else "",
                "client_name": d.client_name or "",
                "company": "",
                "location": "",
                "quality": d.response_quality or "Positive Response",
                "employee": name,
            }
            for d, name in detail_results[:20]
        ]
    else:
        hq_count = 0
        gi_count = 0

        by_employee_stacked = [
            {
                "employee": name, "high_quality": 0,
                "positive_response": d["pr"], "generic_interest": 0,
                "color": PERSON_COLORS.get(name, "#666"),
            }
            for name, d in emp_data.items()
        ]

        quality_distribution = [
            {"name": "Positive Response", "value": total_pr, "color": "#10B981"},
        ]

        recent_responses = []

    kpis = {
        "total": total_pr, "high_quality": hq_count,
        "generic_interest": gi_count, "best_rate_employee": best_rate_emp,
        "best_rate": best_rate,
    }

    monthly = {}
    for r, name in results:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "positive_responses": 0, "leads": 0}
        monthly[key]["positive_responses"] += safe_int(r.positive_responses)
        monthly[key]["leads"] += safe_int(r.leads_generated)
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    return {
        "kpis": kpis, "by_employee_stacked": by_employee_stacked,
        "quality_distribution": quality_distribution,
        "monthly_trend": monthly_trend, "recent_responses": recent_responses,
        "has_detail_data": has_detail_data,
    }
