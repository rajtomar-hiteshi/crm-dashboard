import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person, PositiveResponse, LeadGenerated
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/positive-responses")
def get_positive_responses(
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

    detail_base = db.query(PositiveResponse, Person.short_name)\
        .outerjoin(Person, PositiveResponse.person_id == Person.id)
    detail_base = apply_filters(detail_base, PositiveResponse.person_id, PositiveResponse.response_date, **fkw)
    detail_results = detail_base.order_by(PositiveResponse.response_date.desc()).all()
    total_pr = len(detail_results)
    has_detail_data = total_pr > 0
    logger.info(f"PositiveResponses: {len(results)} tt rows, {total_pr} actual PR records")

    leads_q = db.query(LeadGenerated.person_id, LeadGenerated.inquiry_date)
    leads_q = apply_filters(leads_q, LeadGenerated.person_id, LeadGenerated.inquiry_date, **fkw)
    leads_records = leads_q.all()

    if not results and not has_detail_data:
        return {
            "kpis": {"total": 0, "high_quality": 0, "generic_interest": 0,
                     "best_rate_employee": "N/A", "best_rate": 0},
            "by_employee_stacked": [], "quality_distribution": [],
            "monthly_trend": [], "recent_responses": [], "has_detail_data": False,
        }

    emp_data = {}
    for r, name in results:
        if name not in emp_data:
            emp_data[name] = {"pr": 0, "conn": 0}
        emp_data[name]["conn"] += safe_int(r.linkedin_connections)

    pr_by_name = {}
    for d, name in detail_results:
        name = name or "Unknown"
        pr_by_name[name] = pr_by_name.get(name, 0) + 1
    for name in emp_data:
        emp_data[name]["pr"] = pr_by_name.get(name, 0)
    for name, cnt in pr_by_name.items():
        if name not in emp_data:
            emp_data[name] = {"pr": cnt, "conn": 0}

    best_rate_emp = "N/A"
    best_rate = 0
    if emp_data:
        best_rate_emp = max(emp_data, key=lambda k: emp_data[k]["pr"] / max(emp_data[k]["conn"], 1))
        best_rate = round(emp_data[best_rate_emp]["pr"] / max(emp_data[best_rate_emp]["conn"], 1) * 100, 2)

    if has_detail_data:
        hq_count = sum(1 for d, _ in detail_results if d.response_quality and "high" in d.response_quality.lower())
        gi_count = sum(1 for d, _ in detail_results if d.response_quality and "generic" in d.response_quality.lower())

        emp_quality = {}
        for d, name in detail_results:
            name = name or "Unknown"
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
        for name in set(emp_data.keys()) | set(emp_quality.keys()):
            eq = emp_quality.get(name, {"high_quality": 0, "positive_response": 0, "generic_interest": 0})
            by_employee_stacked.append({
                "employee": name, **eq,
                "color": PERSON_COLORS.get(name, "#666"),
            })

        quality_distribution = [
            {"name": "High Quality", "value": hq_count, "color": "#3B82F6"},
            {"name": "Positive Response", "value": total_pr - hq_count - gi_count, "color": "#10B981"},
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

    all_responses = [
        {
            "date": d.response_date.isoformat() if d.response_date else "",
            "client_name": d.client_name or "",
            "company": "",
            "location": "",
            "quality": d.response_quality or "Positive Response",
            "employee": name,
            "color": PERSON_COLORS.get(name, "#666"),
        }
        for d, name in detail_results
    ]

    kpis = {
        "total": total_pr, "high_quality": hq_count,
        "generic_interest": gi_count, "best_rate_employee": best_rate_emp,
        "best_rate": best_rate,
    }

    pr_monthly = {}
    for d, name in detail_results:
        if d.response_date:
            m = d.response_date.strftime("%Y-%m")
            pr_monthly[m] = pr_monthly.get(m, 0) + 1

    leads_monthly = {}
    for pid, idate in leads_records:
        if idate:
            m = idate.strftime("%Y-%m")
            leads_monthly[m] = leads_monthly.get(m, 0) + 1

    all_months = set(pr_monthly.keys()) | set(leads_monthly.keys())
    monthly_trend = sorted(
        [{"month": m, "positive_responses": pr_monthly.get(m, 0), "leads": leads_monthly.get(m, 0)} for m in all_months],
        key=lambda x: x["month"],
    )

    return {
        "kpis": kpis, "by_employee_stacked": by_employee_stacked,
        "quality_distribution": quality_distribution,
        "monthly_trend": monthly_trend, "recent_responses": recent_responses,
        "all_responses": all_responses, "has_detail_data": has_detail_data,
    }
