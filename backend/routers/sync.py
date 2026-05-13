import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import Person, IngestionLog
from helpers import PERSON_COLORS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sync/status")
def sync_status(db: Session = Depends(get_db)):
    last = db.query(IngestionLog).order_by(desc(IngestionLog.ingested_at)).first()
    if not last:
        return {"last_sync": None, "status": "never", "records_updated": 0, "message": "No sync performed yet"}
    return {
        "last_sync": last.ingested_at.isoformat() if last.ingested_at else None,
        "status": last.status or "unknown",
        "records_updated": last.rows_inserted or 0,
        "message": f"Last ingested: {last.worksheet_name}",
    }


@router.get("/employees")
def get_employees(db: Session = Depends(get_db)):
    persons = db.query(Person).order_by(Person.short_name).all()
    if not persons:
        return [{"name": e, "color": c} for e, c in PERSON_COLORS.items()]
    return [{"name": p.short_name or p.full_name, "color": PERSON_COLORS.get(p.short_name, "#666")} for p in persons]
