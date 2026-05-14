import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import TargetTracking, Person, PositiveResponse, LeadGenerated
from filters import apply_filters
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter()


def _quarter_key(year_month: str) -> str:
    y, m = year_month.split("-")
    q = (int(m) - 1) // 3 + 1
    return f"Q{q} {y}"


@router.get("/dashboard")
def get_dashboard(
    employee: str = Query("all"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    period: str = Query(None),
    group_by: str = Query("month"),
    db: Session = Depends(get_db),
):
    fkw = dict(employee=employee, start_date=start_date, end_date=end_date, period=period)
    person_map = {p.id: (p.short_name or p.full_name) for p in db.query(Person).all()}

    base = db.query(TargetTracking, Person.short_name)\
        .join(Person, TargetTracking.person_id == Person.id)\
        .filter(TargetTracking.activity_date.isnot(None))
    base = apply_filters(base, TargetTracking.person_id, TargetTracking.activity_date, **fkw)
    results = base.all()

    pr_q = db.query(PositiveResponse.person_id, PositiveResponse.response_date)
    pr_q = apply_filters(pr_q, PositiveResponse.person_id, PositiveResponse.response_date, **fkw)
    pr_records = pr_q.all()

    leads_q = db.query(LeadGenerated.person_id, LeadGenerated.inquiry_date)
    leads_q = apply_filters(leads_q, LeadGenerated.person_id, LeadGenerated.inquiry_date, **fkw)
    leads_records = leads_q.all()

    total_pr = len(pr_records)
    total_leads = len(leads_records)
    logger.info(f"Dashboard: {len(results)} tt rows, {total_pr} PR, {total_leads} leads, employee={employee}")

    pr_by_pid = {}
    for pid, _ in pr_records:
        pr_by_pid[pid] = pr_by_pid.get(pid, 0) + 1

    leads_by_pid = {}
    leads_monthly = {}
    for pid, idate in leads_records:
        leads_by_pid[pid] = leads_by_pid.get(pid, 0) + 1
        if idate:
            m = idate.strftime("%Y-%m")
            leads_monthly[m] = leads_monthly.get(m, 0) + 1

    if not results and not pr_records and not leads_records:
        return {
            "kpis": {"total_connections": 0, "total_followups": 0, "total_inmails": 0,
                     "total_positive_responses": 0, "total_leads": 0, "response_rate": 0},
            "monthly_trend": [], "connection_share": [],
            "employee_comparison": [], "key_metrics": None, "top_performers": [],
        }

    total_conn = sum(safe_int(r.linkedin_connections) for r, _ in results)
    total_fu = sum(safe_int(r.linkedin_follow_ups) for r, _ in results)
    total_im = sum(safe_int(r.linkedin_inmails) for r, _ in results)
    response_rate = round((total_pr / total_conn * 100), 2) if total_conn > 0 else 0

    kpis = {
        "total_connections": total_conn,
        "total_followups": total_fu,
        "total_inmails": total_im,
        "total_positive_responses": total_pr,
        "total_leads": total_leads,
        "response_rate": response_rate,
    }

    monthly_data = {}
    for r, name in results:
        key = r.activity_date.strftime("%Y-%m")
        if key not in monthly_data:
            monthly_data[key] = {"month": key, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
        monthly_data[key]["connections"] += safe_int(r.linkedin_connections)
        monthly_data[key]["follow_ups"] += safe_int(r.linkedin_follow_ups)
        monthly_data[key]["inmails"] += safe_int(r.linkedin_inmails)
    for m in set(monthly_data.keys()) | set(leads_monthly.keys()):
        if m not in monthly_data:
            monthly_data[m] = {"month": m, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
        monthly_data[m]["leads"] = leads_monthly.get(m, 0)
    monthly_trend = sorted(monthly_data.values(), key=lambda x: x["month"])

    if group_by == "quarter":
        quarterly = {}
        for entry in monthly_trend:
            qk = _quarter_key(entry["month"])
            if qk not in quarterly:
                quarterly[qk] = {"period": qk, "connections": 0, "follow_ups": 0, "inmails": 0, "leads": 0}
            quarterly[qk]["connections"] += entry["connections"]
            quarterly[qk]["follow_ups"] += entry["follow_ups"]
            quarterly[qk]["inmails"] += entry["inmails"]
            quarterly[qk]["leads"] += entry["leads"]
        monthly_trend = sorted(quarterly.values(), key=lambda x: x["period"])

    emp_conn = {}
    emp_comp = {}
    for r, name in results:
        if name not in emp_conn:
            emp_conn[name] = 0
            emp_comp[name] = {"employee": name, "connections": 0, "follow_ups": 0, "inmails": 0,
                              "color": PERSON_COLORS.get(name, "#666")}
        emp_conn[name] += safe_int(r.linkedin_connections)
        emp_comp[name]["connections"] += safe_int(r.linkedin_connections)
        emp_comp[name]["follow_ups"] += safe_int(r.linkedin_follow_ups)
        emp_comp[name]["inmails"] += safe_int(r.linkedin_inmails)

    connection_share = [
        {"employee": name, "connections": val, "color": PERSON_COLORS.get(name, "#666")}
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
    for r, name in results:
        pid = r.person_id
        if name not in perf_data:
            perf_data[name] = {"pid": pid, "leads": 0, "responses": 0, "connections": 0}
        perf_data[name]["connections"] += safe_int(r.linkedin_connections)
    for name, d in perf_data.items():
        d["responses"] = pr_by_pid.get(d["pid"], 0)
        d["leads"] = leads_by_pid.get(d["pid"], 0)
    for pid, cnt in pr_by_pid.items():
        pname = person_map.get(pid, f"Person {pid}")
        if pname not in perf_data:
            perf_data[pname] = {"pid": pid, "leads": leads_by_pid.get(pid, 0), "responses": cnt, "connections": 0}
    top_performers = sorted(
        [{"rank": 0, "employee": k, "leads": v["leads"], "responses": v["responses"],
          "connections": v["connections"],
          "color": PERSON_COLORS.get(k, "#666")} for k, v in perf_data.items()],
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
