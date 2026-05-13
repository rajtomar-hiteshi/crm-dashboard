import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity, PositiveResponseDetail
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/positive-responses")
def get_positive_responses(
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
    logger.info(f"PositiveResponses: {len(rows)} rows from daily_activity")

    detail_query = apply_filters(
        db.query(PositiveResponseDetail),
        PositiveResponseDetail.employee_name, PositiveResponseDetail.response_date,
        employee, start_date, end_date,
    )
    details = detail_query.order_by(PositiveResponseDetail.response_date.desc()).all()
    has_detail_data = len(details) > 0
    logger.info(f"PositiveResponses: {len(details)} detail records, has_detail={has_detail_data}")

    if not rows:
        return {
            "kpis": {"total": 0, "high_quality": 0, "generic_interest": 0,
                     "best_rate_employee": "N/A", "best_rate": 0},
            "by_employee_stacked": [], "quality_distribution": [],
            "monthly_trend": [], "recent_responses": [], "has_detail_data": False,
        }

    total_pr = sum(r.positive_responses or 0 for r in rows)

    emp_data = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_data:
            emp_data[name] = {"pr": 0, "conn": 0}
        emp_data[name]["pr"] += r.positive_responses or 0
        emp_data[name]["conn"] += r.linkedin_connections or 0

    best_rate_emp = "N/A"
    best_rate = 0
    if emp_data:
        best_rate_emp = max(emp_data, key=lambda k: emp_data[k]["pr"] / max(emp_data[k]["conn"], 1))
        best_rate = round(emp_data[best_rate_emp]["pr"] / max(emp_data[best_rate_emp]["conn"], 1) * 100, 2)

    if has_detail_data:
        hq_count = sum(1 for d in details if d.quality and "high" in d.quality.lower())
        gi_count = sum(1 for d in details if d.quality and "generic" in d.quality.lower())
        pr_count = total_pr - hq_count - gi_count

        emp_quality = {}
        for d in details:
            name = d.employee_name
            if name not in emp_quality:
                emp_quality[name] = {"high_quality": 0, "positive_response": 0, "generic_interest": 0}
            q = (d.quality or "").lower()
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
                "color": EMPLOYEE_COLORS.get(name, "#666"),
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
                "company": d.company or "",
                "location": d.location or "",
                "quality": d.quality or "Positive Response",
                "employee": d.employee_name,
            }
            for d in details[:20]
        ]
    else:
        hq_count = 0
        gi_count = 0

        by_employee_stacked = [
            {
                "employee": name, "high_quality": 0,
                "positive_response": d["pr"], "generic_interest": 0,
                "color": EMPLOYEE_COLORS.get(name, "#666"),
            }
            for name, d in emp_data.items()
        ]

        quality_distribution = [
            {"name": "Positive Response", "value": total_pr, "color": "#10B981"},
        ]

        recent_responses = []
        for r in sorted(rows, key=lambda x: x.activity_date, reverse=True):
            if r.positive_responses and r.positive_responses > 0:
                recent_responses.append({
                    "date": r.activity_date.isoformat(),
                    "client_name": "",
                    "company": "",
                    "location": "",
                    "quality": "Positive Response",
                    "employee": r.employee_name,
                })
            if len(recent_responses) >= 20:
                break

    kpis = {
        "total": total_pr, "high_quality": hq_count,
        "generic_interest": gi_count, "best_rate_employee": best_rate_emp,
        "best_rate": best_rate,
    }

    monthly = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"month": key, "positive_responses": 0, "leads": 0}
        monthly[key]["positive_responses"] += r.positive_responses or 0
        monthly[key]["leads"] += r.lead_generated or 0
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])

    return {
        "kpis": kpis, "by_employee_stacked": by_employee_stacked,
        "quality_distribution": quality_distribution,
        "monthly_trend": monthly_trend, "recent_responses": recent_responses,
        "has_detail_data": has_detail_data,
    }
