import re
import os
import logging
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials
from sqlalchemy.dialects.postgresql import insert
from dateutil import parser as date_parser

from database import SessionLocal
from models import DailyActivity, SyncLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "..", "credentials.json")

EMPLOYEE_COLORS = {
    "Yogita": "#3B82F6",
    "Karishma": "#06B6D4",
    "Ragini": "#10B981",
    "Tanishqa": "#F59E0B",
    "Yashika": "#8B5CF6",
    "Seema": "#EF4444",
    "Arni": "#F97316",
}

SHEET_CONFIGS = [
    {
        "employee": "Karishma",
        "sheet_id": "1UrX3eApvrdt71CBWYzwR5rgQoadBW4MT",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "data_extraction": 4, "emails": 5,
            "positive_responses": 6,
        },
        "source": "Karishma_LIVE",
    },
    {
        "employee": "Karishma",
        "sheet_id": "1POJEOZLz64brvaY2uFrIiB2XLfcdW_b5",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "cold_calling": 6, "follow_up_calls": 7,
        },
        "source": "Karishma_HISTORICAL",
    },
    {
        "employee": "Ragini",
        "sheet_id": "17wJHNybIaEDMNbjwT32EveHyKUjpHy_9",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "positive_responses": 6, "lead_generated": 7, "calls": 8,
        },
        "source": "Ragini_ONLY",
    },
    {
        "employee": "Yashika",
        "sheet_id": "1x-zgfxJ7e_OAn-ZYck-tDjzi1JiGYGT6",
        "tab": "Traget Tracking",
        "format": "yashika_2025",
        "columns": {
            "date": 2, "linkedin_connections": 4, "linkedin_follow_ups": 6,
            "linkedin_inmails": 8, "emails": 10,
        },
        "source": "Yashika_2025",
    },
    {
        "employee": "Yashika",
        "sheet_id": "1Qf5yajYi2GCtoaL0N33r3pmT8Gw8y1xB",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "cold_calling": 6, "follow_up_calls": 7,
        },
        "source": "Yashika_HISTORICAL",
    },
    {
        "employee": "Yashika",
        "sheet_id": "1FSCyVMwZFHtpJ9VQtAaLTKXgqQ_4EOrn",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "cold_calling": 6, "follow_up_calls": 7,
        },
        "source": "Yashika_LIVE",
    },
    {
        "employee": "Yogita",
        "sheet_id": "1vBKS2dq7DEmjexFxLXwzdLyOVGRV7ALE",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "positive_responses": 6,
        },
        "source": "Yogita_HISTORICAL",
    },
    {
        "employee": "Yogita",
        "sheet_id": "1uvFqIE2tGKwWWbhu55PIVDf4d4wdw68i",
        "tab": "Target Tracking",
        "format": "standard",
        "columns": {
            "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
            "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
            "positive_responses": 6,
        },
        "source": "Yogita_LIVE",
    },
]


def extract_number(value):
    if value is None or str(value).strip() == "":
        return 0
    s = str(value).strip().lower()
    if s in ("leave", "absent", "holiday", "off", "-", "n/a"):
        return 0
    match = re.match(r"(\d+)", s)
    if match:
        return int(match.group(1))
    return 0


def parse_date(value, fmt="standard"):
    if value is None or str(value).strip() == "":
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        if fmt == "yashika_2025":
            return date_parser.parse(s).date()
        parts = s.replace("/", "-").split("-")
        if len(parts) == 3:
            if len(parts[2]) == 4:
                return datetime.strptime("-".join(parts), "%d-%m-%Y").date()
            elif len(parts[0]) == 4:
                return datetime.strptime("-".join(parts), "%Y-%m-%d").date()
            else:
                return datetime.strptime("-".join(parts), "%d-%m-%Y").date()
        return date_parser.parse(s).date()
    except (ValueError, TypeError):
        return None


def get_gspread_client():
    creds = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
    return gspread.authorize(creds)


def sync_sheet(gc, config):
    records = []
    try:
        spreadsheet = gc.open_by_key(config["sheet_id"])
        worksheet = spreadsheet.worksheet(config["tab"])
        all_values = worksheet.get_all_values()
    except Exception as e:
        logger.error(f"Error opening sheet {config['source']}: {e}")
        return records

    start_row = 1
    cols = config["columns"]
    date_fmt = config.get("format", "standard")
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols["date"]
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 5:
                break
            continue
        consecutive_empty = 0

        activity_date = parse_date(row[date_col], date_fmt)
        if activity_date is None:
            continue

        def get_val(field):
            col_idx = cols.get(field)
            if col_idx is None or col_idx >= len(row):
                return 0
            return extract_number(row[col_idx])

        record = {
            "employee_name": config["employee"],
            "activity_date": activity_date,
            "linkedin_connections": get_val("linkedin_connections"),
            "linkedin_follow_ups": get_val("linkedin_follow_ups"),
            "linkedin_inmails": get_val("linkedin_inmails"),
            "emails": get_val("emails"),
            "data_extraction": get_val("data_extraction"),
            "positive_responses": get_val("positive_responses"),
            "lead_generated": get_val("lead_generated"),
            "cold_calling": get_val("cold_calling"),
            "follow_up_calls": get_val("follow_up_calls"),
            "calls": get_val("calls"),
            "source_file": config["source"],
        }
        records.append(record)

    logger.info(f"Parsed {len(records)} records from {config['source']}")
    return records


def upsert_records(db, records):
    if not records:
        return 0
    count = 0
    for record in records:
        stmt = insert(DailyActivity).values(**record)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_employee_date",
            set_={
                "linkedin_connections": stmt.excluded.linkedin_connections,
                "linkedin_follow_ups": stmt.excluded.linkedin_follow_ups,
                "linkedin_inmails": stmt.excluded.linkedin_inmails,
                "emails": stmt.excluded.emails,
                "data_extraction": stmt.excluded.data_extraction,
                "positive_responses": stmt.excluded.positive_responses,
                "lead_generated": stmt.excluded.lead_generated,
                "cold_calling": stmt.excluded.cold_calling,
                "follow_up_calls": stmt.excluded.follow_up_calls,
                "calls": stmt.excluded.calls,
                "source_file": stmt.excluded.source_file,
                "updated_at": datetime.utcnow(),
            },
        )
        db.execute(stmt)
        count += 1
    db.commit()
    return count


def run_sync():
    db = SessionLocal()
    total_records = 0
    status = "success"
    message = ""
    try:
        gc = get_gspread_client()
        for config in SHEET_CONFIGS:
            try:
                records = sync_sheet(gc, config)
                count = upsert_records(db, records)
                total_records += count
                logger.info(f"Upserted {count} records for {config['source']}")
            except Exception as e:
                logger.error(f"Error syncing {config['source']}: {e}")
                message += f"Error in {config['source']}: {str(e)}; "
        if message:
            status = "partial"
        else:
            message = f"Successfully synced {total_records} records"
    except Exception as e:
        status = "error"
        message = str(e)
        logger.error(f"Sync failed: {e}")
    finally:
        log_entry = SyncLog(
            status=status,
            records_updated=total_records,
            message=message[:500],
        )
        db.add(log_entry)
        db.commit()
        db.close()
    return {"status": status, "records_updated": total_records, "message": message}


if __name__ == "__main__":
    result = run_sync()
    print(result)
