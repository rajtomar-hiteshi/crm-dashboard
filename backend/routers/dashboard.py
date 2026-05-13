import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DailyActivity
from filters import apply_filters
from sync_sheets import EMPLOYEE_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
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
    logger.info(f"Dashboard: {len(rows)} rows, employee={employee}, start={start_date}, end={end_date}")

    if not rows:
        return {
            "kpis": {"total_connections": 0, "total_followups": 0, "total_inmails": 0,
                     "total_positive_responses": 0, "total_leads": 0, "response_rate": 0},
            "monthly_trend": [], "connection_share": [],
            "employee_comparison": [], "key_metrics": None, "top_performers": [],
        }

    total_conn = sum(r.linkedin_connections or 0 for r in rows)
    total_fu = sum(r.linkedin_follow_ups or 0 for r in rows)
    total_im = sum(r.linkedin_inmails or 0 for r in rows)
    total_pr = sum(r.positive_responses or 0 for r in rows)
    total_leads = sum(r.lead_generated or 0 for r in rows)
    response_rate = round((total_pr / total_conn * 100), 2) if total_conn > 0 else 0

    logger.info(f"KPIs: conn={total_conn} fu={total_fu} im={total_im} pr={total_pr} leads={total_leads} rate={response_rate}")

    kpis = {
        "total_connections": total_conn,
        "total_followups": total_fu,
        "total_inmails": total_im,
        "total_positive_responses": total_pr,
        "total_leads": total_leads,
        "response_rate": response_rate,
    }

    monthly_data = {}
    for r in rows:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly_data:
            monthly_data[key] = {"month": key, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
        monthly_data[key]["connections"] += r.linkedin_connections or 0
        monthly_data[key]["follow_ups"] += r.linkedin_follow_ups or 0
        monthly_data[key]["inmails"] += r.linkedin_inmails or 0
        monthly_data[key]["leads"] += r.lead_generated or 0
    monthly_trend = sorted(monthly_data.values(), key=lambda x: x["month"])

    emp_conn = {}
    emp_comp = {}
    for r in rows:
        name = r.employee_name
        if name not in emp_conn:
            emp_conn[name] = 0
            emp_comp[name] = {"employee": name, "connections": 0, "follow_ups": 0, "inmails": 0,
                              "color": EMPLOYEE_COLORS.get(name, "#666")}
        emp_conn[name] += r.linkedin_connections or 0
        emp_comp[name]["connections"] += r.linkedin_connections or 0
        emp_comp[name]["follow_ups"] += r.linkedin_follow_ups or 0
        emp_comp[name]["inmails"] += r.linkedin_inmails or 0

    connection_share = [
        {"employee": name, "connections": val, "color": EMPLOYEE_COLORS.get(name, "#666")}
        for name, val in emp_conn.items()
    ]
    employee_comparison = list(emp_comp.values())

    key_metrics = None
    if employee and employee != "all":
        conv_rate = round((total_leads / total_conn * 100), 2) if total_conn > 0 else 0
        inmail_rate = round((total_im / total_conn * 100), 2) if total_conn > 0 else 0
        fu_coverage = round((total_fu / total_conn * 100), 2) if total_conn > 0 else 0
        key_metrics = {
            "conversion_rate": conv_rate,
            "response_rate": response_rate,
            "inmail_rate": inmail_rate,
            "fu_coverage": fu_coverage,
        }

    perf_data = {}
    for r in rows:
        name = r.employee_name
        if name not in perf_data:
            perf_data[name] = {"leads": 0, "responses": 0, "connections": 0}
        perf_data[name]["leads"] += r.lead_generated or 0
        perf_data[name]["responses"] += r.positive_responses or 0
        perf_data[name]["connections"] += r.linkedin_connections or 0
    top_performers = sorted(
        [{"rank": 0, "employee": k, "leads": v["leads"], "responses": v["responses"],
          "connections": v["connections"],
          "color": EMPLOYEE_COLORS.get(k, "#666")} for k, v in perf_data.items()],
        key=lambda x: (x["leads"], x["responses"], x["connections"]), reverse=True,
    )
    for i, p in enumerate(top_performers):
        p["rank"] = i + 1

    return {
        "kpis": kpis,
        "monthly_trend": monthly_trend,
        "connection_share": connection_share,
        "employee_comparison": employee_comparison,
        "key_metrics": key_metrics,
        "top_performers": top_performers[:10],
    }
