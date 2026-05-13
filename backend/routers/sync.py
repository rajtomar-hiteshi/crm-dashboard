from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import DailyActivity, SyncLog
from sync_sheets import run_sync, EMPLOYEE_COLORS

router = APIRouter()


@router.post("/sync")
def trigger_sync():
    result = run_sync()
    return result


@router.get("/sync/status")
def sync_status(db: Session = Depends(get_db)):
    last = db.query(SyncLog).order_by(desc(SyncLog.sync_time)).first()
    if not last:
        return {"last_sync": None, "status": "never", "records_updated": 0, "message": "No sync performed yet"}
    return {
        "last_sync": last.sync_time.isoformat() if last.sync_time else None,
        "status": last.status,
        "records_updated": last.records_updated,
        "message": last.message,
    }


@router.get("/employees")
def get_employees(db: Session = Depends(get_db)):
    names = db.query(DailyActivity.employee_name).distinct().all()
    employees = [n[0] for n in names]
    if not employees:
        employees = list(EMPLOYEE_COLORS.keys())
    return [{"name": e, "color": EMPLOYEE_COLORS.get(e, "#666")} for e in sorted(employees)]
