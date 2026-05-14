import logging
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    Person, SourceFile, TargetTracking, DailyTarget,
    LinkedinConnection, LinkedinFollowup, LinkedinInmail,
    Email, DataExtractionRecord, PositiveResponse, LeadGenerated,
    OtherWorksheetData, IngestionLog,
)
from helpers import PERSON_COLORS, safe_int

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings")

SERVICE_ACCOUNT_EMAIL = "leadgen-sync@leadgen-crm-496210.iam.gserviceaccount.com"


def extract_file_id(url_or_id: str) -> str:
    url_or_id = url_or_id.strip()
    if "/" not in url_or_id and len(url_or_id) > 20:
        return url_or_id
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url_or_id)
    if m:
        return m.group(1)
    m = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url_or_id)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url_or_id)
    if m:
        return m.group(1)
    return url_or_id


KNOWN_WORKSHEET_PATTERNS = {
    "target_tracking": {
        "patterns": ["target tracking", "target", "daily tracking"],
        "table": "target_tracking",
        "key_columns": ["date", "linkedin", "connections", "follow", "inmail"],
    },
    "linkedin_connections": {
        "patterns": ["linkedin connection", "connections", "linkedin conn"],
        "table": "linkedin_connections",
        "key_columns": ["date", "linkedin", "url", "account", "connection"],
    },
    "linkedin_followups": {
        "patterns": ["linkedin follow", "follow up", "followup"],
        "table": "linkedin_followups",
        "key_columns": ["date", "linkedin", "url", "follow", "message"],
    },
    "linkedin_inmails": {
        "patterns": ["linkedin inmail", "inmail", "in mail", "in-mail"],
        "table": "linkedin_inmails",
        "key_columns": ["date", "linkedin", "url", "inmail", "message"],
    },
    "emails": {
        "patterns": ["email", "cold email", "mail outreach"],
        "table": "emails",
        "key_columns": ["date", "client", "email", "company"],
    },
    "data_extraction": {
        "patterns": ["data extraction", "extraction", "prospect data"],
        "table": "data_extraction",
        "key_columns": ["date", "prospect", "company", "email", "linkedin"],
    },
    "positive_responses": {
        "patterns": ["positive response", "positive", "pr ", "new pr", "old pr"],
        "table": "positive_responses",
        "key_columns": ["date", "client", "quality", "response", "linkedin"],
    },
    "leads_generated": {
        "patterns": ["lead generated", "lead gen", "leads", "sales inquiry", "presales"],
        "table": "leads_generated",
        "key_columns": ["date", "client", "company", "location", "linkedin"],
    },
}


def _get_gspread_client():
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        raise HTTPException(status_code=500, detail="gspread/google-auth not installed")

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds_path = os.path.join(os.path.dirname(__file__), "..", "..", "credentials.json")
    if not os.path.exists(creds_path):
        creds_path = os.path.join(os.path.dirname(__file__), "..", "credentials.json")
    if not os.path.exists(creds_path):
        raise HTTPException(status_code=500, detail="credentials.json not found")

    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    return gspread.authorize(creds)


def _get_drive_service():
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds_path = os.path.join(os.path.dirname(__file__), "..", "..", "credentials.json")
    if not os.path.exists(creds_path):
        creds_path = os.path.join(os.path.dirname(__file__), "..", "credentials.json")

    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    return build("drive", "v3", credentials=creds)


def _auto_detect_worksheet(name, headers):
    name_lower = name.lower().strip()
    for ws_type, config in KNOWN_WORKSHEET_PATTERNS.items():
        for pattern in config["patterns"]:
            if pattern in name_lower:
                return config["table"]

    if headers:
        headers_lower = [str(h).lower() for h in headers]
        headers_text = " ".join(headers_lower)
        for ws_type, config in KNOWN_WORKSHEET_PATTERNS.items():
            matches = sum(1 for kc in config["key_columns"] if any(kc in h for h in headers_lower))
            if matches >= 3:
                return config["table"]

    return None


@router.post("/search-drive")
def search_drive(body: dict, db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    try:
        drive = _get_drive_service()
    except Exception as e:
        logger.error(f"Drive service error: {e}")
        return {"files": [], "error": f"Could not connect to Google Drive: {str(e)}"}

    parts = name.split()
    queries = []
    queries.append(f"name contains 'Lead Generation' and name contains '{parts[0]}'")
    if len(parts) > 1:
        queries.append(f"name contains '{parts[0]}' and name contains '{parts[1]}'")
    queries.append(f"name contains '{name}'")

    seen_ids = set()
    files = []
    for q in queries:
        try:
            query = f"({q}) and trashed=false and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')"
            result = drive.files().list(
                q=query,
                fields="files(id,name,mimeType,modifiedTime,size)",
                pageSize=20,
                orderBy="modifiedTime desc",
            ).execute()
            for f in result.get("files", []):
                if f["id"] not in seen_ids:
                    seen_ids.add(f["id"])
                    files.append({
                        "drive_file_id": f["id"],
                        "name": f["name"],
                        "mime_type": f["mimeType"],
                        "modified_time": f.get("modifiedTime"),
                        "size": f.get("size"),
                    })
        except Exception as e:
            logger.warning(f"Drive search query failed: {e}")

    return {"files": files, "search_name": name}


@router.post("/scan-file")
def scan_file(body: dict, db: Session = Depends(get_db)):
    raw_id = body.get("drive_file_id", "").strip()
    file_type = body.get("file_type", "CURRENT")

    if not raw_id:
        raise HTTPException(status_code=400, detail="drive_file_id is required")

    drive_file_id = extract_file_id(raw_id)

    try:
        gc = _get_gspread_client()
        spreadsheet = gc.open_by_key(drive_file_id)
    except Exception as e:
        err = str(e)
        if "404" in err or "not found" in err.lower():
            raise HTTPException(
                status_code=404,
                detail=f"File not found. Please share the Google Sheet with the service account email: {SERVICE_ACCOUNT_EMAIL}",
            )
        raise HTTPException(status_code=400, detail=f"Could not open file: {err}")

    worksheets = []
    for ws in spreadsheet.worksheets():
        try:
            all_values = ws.get_all_values()
            row_count = max(0, len(all_values) - 1)
            headers = all_values[0] if all_values else []
            non_empty_headers = [h for h in headers if str(h).strip()]

            mapped_table = _auto_detect_worksheet(ws.title, headers)

            worksheets.append({
                "name": ws.title,
                "rows": row_count,
                "columns": non_empty_headers,
                "mapped_table": mapped_table or "UNKNOWN",
                "is_empty": row_count == 0,
            })
        except Exception as e:
            worksheets.append({
                "name": ws.title,
                "rows": 0,
                "columns": [],
                "mapped_table": "ERROR",
                "error": str(e),
                "is_empty": True,
            })

    total_rows = sum(ws["rows"] for ws in worksheets)

    return {
        "file_name": spreadsheet.title,
        "drive_file_id": drive_file_id,
        "file_type": file_type,
        "worksheets": worksheets,
        "total_rows": total_rows,
        "total_worksheets": len(worksheets),
    }


@router.post("/add-person")
def add_person(body: dict, db: Session = Depends(get_db)):
    full_name = body.get("full_name", "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    short_name = body.get("short_name", "").strip() or full_name.split()[0]
    email = body.get("email", "").strip() or None
    role = body.get("role", "Lead Gen Executive")

    existing = db.query(Person).filter(Person.full_name == full_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Person '{full_name}' already exists")

    person = Person(
        full_name=full_name,
        short_name=short_name,
        email=email,
        role=role,
        created_at=datetime.now(),
    )
    db.add(person)
    db.flush()

    files_data = body.get("files", [])
    import_results = []

    for file_info in files_data:
        drive_file_id = extract_file_id(file_info.get("drive_file_id", ""))
        file_type = file_info.get("file_type", "CURRENT")
        approved_worksheets = file_info.get("worksheets_approved", [])

        sf = SourceFile(
            person_id=person.id,
            file_name=file_info.get("file_name", ""),
            drive_file_id=drive_file_id,
            file_type=file_type,
            total_worksheets=len(approved_worksheets),
            ingested_at=datetime.now(),
        )
        db.add(sf)
        db.flush()

        file_result = {
            "file_name": sf.file_name,
            "worksheets": [],
            "total_imported": 0,
        }

        for ws_info in approved_worksheets:
            ws_name = ws_info.get("name", "")
            mapped_table = ws_info.get("mapped_table", "SKIP")
            if mapped_table in ("SKIP", "UNKNOWN", "ERROR"):
                if mapped_table == "UNKNOWN" and ws_info.get("store_as_jsonb"):
                    rows_imported = _import_as_jsonb(db, person.id, sf.id, drive_file_id, ws_name)
                    file_result["worksheets"].append({
                        "name": ws_name, "table": "other_worksheet_data",
                        "rows_imported": rows_imported, "status": "ok",
                    })
                    file_result["total_imported"] += rows_imported
                continue

            try:
                rows_imported = _import_worksheet(
                    db, person.id, sf.id, drive_file_id, ws_name, mapped_table
                )
                file_result["worksheets"].append({
                    "name": ws_name, "table": mapped_table,
                    "rows_imported": rows_imported, "status": "ok",
                })
                file_result["total_imported"] += rows_imported

                db.add(IngestionLog(
                    source_file_id=sf.id, person_id=person.id,
                    worksheet_name=ws_name, target_table=mapped_table,
                    rows_in_sheet=rows_imported, rows_inserted=rows_imported,
                    columns_in_sheet=0, columns_mapped=0,
                    status="ok", ingested_at=datetime.now(),
                ))
            except Exception as e:
                logger.error(f"Import error {ws_name}: {e}")
                file_result["worksheets"].append({
                    "name": ws_name, "table": mapped_table,
                    "rows_imported": 0, "status": "error", "error": str(e),
                })
                db.add(IngestionLog(
                    source_file_id=sf.id, person_id=person.id,
                    worksheet_name=ws_name, target_table=mapped_table,
                    rows_in_sheet=0, rows_inserted=0,
                    columns_in_sheet=0, columns_mapped=0,
                    status="error", error_message=str(e)[:500],
                    ingested_at=datetime.now(),
                ))

        import_results.append(file_result)

    db.commit()

    total_rows = sum(r["total_imported"] for r in import_results)

    return {
        "status": "ok",
        "person": {
            "id": person.id,
            "full_name": person.full_name,
            "short_name": person.short_name,
        },
        "files_imported": len(import_results),
        "total_rows": total_rows,
        "import_results": import_results,
    }


def _import_worksheet(db, person_id, source_file_id, drive_file_id, ws_name, mapped_table):
    from sync_sheets import parse_date, safe_str, extract_number

    gc = _get_gspread_client()
    spreadsheet = gc.open_by_key(drive_file_id)
    worksheet = spreadsheet.worksheet(ws_name)
    all_values = worksheet.get_all_values()

    if len(all_values) <= 1:
        return 0

    headers = [str(h).strip().lower() for h in all_values[0]]
    count = 0

    def find_col(keywords):
        for i, h in enumerate(headers):
            for kw in keywords:
                if kw in h:
                    return i
        return None

    if mapped_table == "target_tracking":
        date_col = find_col(["date"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = TargetTracking(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                linkedin_connections=str(extract_number(row[find_col(["connection"])] if find_col(["connection"]) is not None and find_col(["connection"]) < len(row) else 0)),
                linkedin_follow_ups=str(extract_number(row[find_col(["follow"])] if find_col(["follow"]) is not None and find_col(["follow"]) < len(row) else 0)),
                linkedin_inmails=str(extract_number(row[find_col(["inmail", "in mail"])] if find_col(["inmail", "in mail"]) is not None and find_col(["inmail", "in mail"]) < len(row) else 0)),
                emails=str(extract_number(row[find_col(["email"])] if find_col(["email"]) is not None and find_col(["email"]) < len(row) else 0)),
                data_extraction=str(extract_number(row[find_col(["extraction", "data ext"])] if find_col(["extraction", "data ext"]) is not None and find_col(["extraction", "data ext"]) < len(row) else 0)),
                positive_responses=str(extract_number(row[find_col(["positive", "response"])] if find_col(["positive", "response"]) is not None and find_col(["positive", "response"]) < len(row) else 0)),
                leads_generated=str(extract_number(row[find_col(["lead"])] if find_col(["lead"]) is not None and find_col(["lead"]) < len(row) else 0)),
                team_member_name=None,
            )
            db.add(record)
            count += 1

    elif mapped_table == "linkedin_connections":
        date_col = find_col(["date"])
        url_col = find_col(["url", "linkedin"])
        acct_col = find_col(["account"])
        msg_col = find_col(["message", "connection msg"])
        geo_col = find_col(["geography", "geo"])
        ind_col = find_col(["industry"])
        cad_col = find_col(["cadence", "sequence"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = LinkedinConnection(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                client_linkedin_url=safe_str(row, url_col),
                linkedin_account_used=safe_str(row, acct_col),
                connection_message=safe_str(row, msg_col),
                geography=safe_str(row, geo_col),
                industry=safe_str(row, ind_col),
                cadence_sequence=safe_str(row, cad_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "linkedin_followups":
        date_col = find_col(["date"])
        url_col = find_col(["url", "linkedin"])
        acct_col = find_col(["account"])
        type_col = find_col(["type"])
        msg_col = find_col(["message"])
        cad_col = find_col(["cadence"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = LinkedinFollowup(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                client_linkedin_url=safe_str(row, url_col),
                linkedin_account_used=safe_str(row, acct_col),
                follow_up_type=safe_str(row, type_col),
                message_sent=safe_str(row, msg_col),
                cadence=safe_str(row, cad_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "linkedin_inmails":
        date_col = find_col(["date"])
        url_col = find_col(["url", "linkedin"])
        acct_col = find_col(["account"])
        msg_col = find_col(["message", "inmail"])
        geo_col = find_col(["geography"])
        ind_col = find_col(["industry"])
        cad_col = find_col(["cadence"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = LinkedinInmail(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                client_linkedin_url=safe_str(row, url_col),
                linkedin_account_used=safe_str(row, acct_col),
                inmail_message_sent=safe_str(row, msg_col),
                geography=safe_str(row, geo_col),
                industry=safe_str(row, ind_col),
                cadence=safe_str(row, cad_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "emails":
        date_col = find_col(["date"])
        name_col = find_col(["client name", "name"])
        email_col = find_col(["email"])
        url_col = find_col(["linkedin", "url"])
        comp_col = find_col(["company"])
        content_col = find_col(["content", "draft", "email sent"])
        cad_col = find_col(["cadence"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = Email(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                client_name=safe_str(row, name_col),
                client_email=safe_str(row, email_col),
                client_linkedin_url=safe_str(row, url_col),
                company_name=safe_str(row, comp_col),
                email_content_sent=safe_str(row, content_col),
                cadence=safe_str(row, cad_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "data_extraction":
        date_col = find_col(["date"])
        name_col = find_col(["prospect", "name"])
        comp_col = find_col(["company"])
        email_col = find_col(["email"])
        url_col = find_col(["linkedin", "url"])
        src_col = find_col(["source"])
        region_col = find_col(["region", "location"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            activity_date = parse_date(row[date_col])
            if not activity_date:
                continue
            record = DataExtractionRecord(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, activity_date=activity_date,
                activity_date_raw=str(row[date_col]).strip(),
                prospect_name=safe_str(row, name_col),
                prospect_company=safe_str(row, comp_col),
                client_email=safe_str(row, email_col),
                client_linkedin_url=safe_str(row, url_col),
                source_of_data=safe_str(row, src_col),
                region=safe_str(row, region_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "positive_responses":
        date_col = find_col(["date", "response date"])
        name_col = find_col(["client name", "name"])
        url_col = find_col(["linkedin", "url"])
        quality_col = find_col(["quality"])
        summary_col = find_col(["summary", "chat", "revert"])
        source_col = find_col(["source"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            response_date = parse_date(row[date_col])
            if not response_date:
                continue
            record = PositiveResponse(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, response_date=response_date,
                response_date_raw=str(row[date_col]).strip(),
                client_name=safe_str(row, name_col),
                client_linkedin_id=safe_str(row, url_col),
                response_quality=safe_str(row, quality_col),
                chat_summary=safe_str(row, summary_col),
                source=safe_str(row, source_col),
            )
            db.add(record)
            count += 1

    elif mapped_table == "leads_generated":
        date_col = find_col(["date", "inquiry", "lead date"])
        name_col = find_col(["client name", "name"])
        comp_col = find_col(["company"])
        loc_col = find_col(["location"])
        url_col = find_col(["linkedin", "url"])
        status_col = find_col(["status"])
        for row in all_values[1:]:
            if date_col is None or date_col >= len(row) or not str(row[date_col]).strip():
                continue
            inquiry_date = parse_date(row[date_col])
            if not inquiry_date:
                continue
            record = LeadGenerated(
                person_id=person_id, source_file_id=source_file_id,
                original_worksheet=ws_name, inquiry_date=inquiry_date,
                inquiry_date_raw=str(row[date_col]).strip(),
                client_name=safe_str(row, name_col),
                company_name=safe_str(row, comp_col),
                client_location=safe_str(row, loc_col),
                client_linkedin_url=safe_str(row, url_col),
                current_status=safe_str(row, status_col),
            )
            db.add(record)
            count += 1

    db.flush()
    return count


def _import_as_jsonb(db, person_id, source_file_id, drive_file_id, ws_name):
    gc = _get_gspread_client()
    spreadsheet = gc.open_by_key(drive_file_id)
    worksheet = spreadsheet.worksheet(ws_name)
    all_values = worksheet.get_all_values()

    if len(all_values) <= 1:
        return 0

    headers = [str(h).strip() for h in all_values[0]]
    count = 0
    for i, row in enumerate(all_values[1:], start=2):
        row_data = {headers[j]: row[j] for j in range(min(len(headers), len(row))) if row[j].strip()}
        if not row_data:
            continue
        record = OtherWorksheetData(
            person_id=person_id, source_file_id=source_file_id,
            original_worksheet=ws_name, row_number=i,
            row_data=row_data, created_at=datetime.now(),
        )
        db.add(record)
        count += 1
    db.flush()
    return count


TABLE_MODELS = {
    "target_tracking": TargetTracking,
    "linkedin_connections": LinkedinConnection,
    "linkedin_followups": LinkedinFollowup,
    "linkedin_inmails": LinkedinInmail,
    "emails": Email,
    "data_extraction": DataExtractionRecord,
    "positive_responses": PositiveResponse,
    "leads_generated": LeadGenerated,
    "other_worksheet_data": OtherWorksheetData,
}


@router.get("/persons")
def list_persons(db: Session = Depends(get_db)):
    persons = db.query(Person).order_by(Person.full_name).all()
    result = []
    for p in persons:
        files = db.query(SourceFile).filter(SourceFile.person_id == p.id).all()
        total_rows = 0
        for model in TABLE_MODELS.values():
            if hasattr(model, 'person_id'):
                total_rows += db.query(func.count(model.id)).filter(model.person_id == p.id).scalar() or 0

        current_file = None
        for f in files:
            if f.file_type == "CURRENT":
                current_file = f.file_name
                break
        if not current_file and files:
            current_file = files[-1].file_name

        past_count = sum(1 for f in files if f.file_type == "PAST")
        current_count = sum(1 for f in files if f.file_type == "CURRENT")

        last_log = db.query(IngestionLog)\
            .filter(IngestionLog.person_id == p.id)\
            .order_by(IngestionLog.ingested_at.desc()).first()

        result.append({
            "id": p.id,
            "full_name": p.full_name,
            "short_name": p.short_name,
            "email": p.email,
            "role": p.role or "Lead Gen Executive",
            "color": PERSON_COLORS.get(p.short_name, "#666"),
            "files_count": len(files),
            "past_files": past_count,
            "current_files": current_count,
            "total_rows": total_rows,
            "current_file": current_file,
            "last_synced": last_log.ingested_at.isoformat() if last_log and last_log.ingested_at else None,
        })
    return result


@router.get("/person/{person_id}/files")
def get_person_files(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    files = db.query(SourceFile).filter(SourceFile.person_id == person_id)\
        .order_by(SourceFile.ingested_at.desc()).all()

    result = []
    for f in files:
        logs = db.query(IngestionLog).filter(IngestionLog.source_file_id == f.id).all()
        worksheets = [
            {
                "name": log.worksheet_name,
                "table": log.target_table,
                "rows_imported": log.rows_inserted,
                "status": log.status,
            }
            for log in logs
        ]
        result.append({
            "id": f.id,
            "file_name": f.file_name,
            "drive_file_id": f.drive_file_id,
            "file_type": f.file_type,
            "total_worksheets": f.total_worksheets,
            "ingested_at": f.ingested_at.isoformat() if f.ingested_at else None,
            "worksheets": worksheets,
        })

    return {
        "person": {"id": person.id, "full_name": person.full_name, "short_name": person.short_name},
        "files": result,
    }


@router.post("/person/{person_id}/add-file")
def add_file_to_person(person_id: int, body: dict, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    drive_file_id = extract_file_id(body.get("drive_file_id", "").strip())
    file_type = body.get("file_type", "CURRENT")
    worksheets_approved = body.get("worksheets_approved", [])

    if not drive_file_id:
        raise HTTPException(status_code=400, detail="drive_file_id is required")

    try:
        gc = _get_gspread_client()
        spreadsheet = gc.open_by_key(drive_file_id)
        file_name = spreadsheet.title
    except Exception as e:
        err = str(e)
        if "404" in err or "not found" in err.lower():
            raise HTTPException(
                status_code=404,
                detail=f"File not found. Please share the Google Sheet with: {SERVICE_ACCOUNT_EMAIL}",
            )
        raise HTTPException(status_code=400, detail=f"Could not open file: {err}")

    sf = SourceFile(
        person_id=person_id, file_name=file_name,
        drive_file_id=drive_file_id, file_type=file_type,
        total_worksheets=len(worksheets_approved),
        ingested_at=datetime.now(),
    )
    db.add(sf)
    db.flush()

    total_imported = 0
    results = []
    for ws_info in worksheets_approved:
        ws_name = ws_info.get("name", "")
        mapped_table = ws_info.get("mapped_table", "SKIP")
        if mapped_table in ("SKIP", "ERROR"):
            continue
        if mapped_table == "UNKNOWN" and ws_info.get("store_as_jsonb"):
            rows = _import_as_jsonb(db, person_id, sf.id, drive_file_id, ws_name)
            results.append({"name": ws_name, "table": "other_worksheet_data", "rows": rows, "status": "ok"})
            total_imported += rows
            continue
        try:
            rows = _import_worksheet(db, person_id, sf.id, drive_file_id, ws_name, mapped_table)
            results.append({"name": ws_name, "table": mapped_table, "rows": rows, "status": "ok"})
            total_imported += rows
            db.add(IngestionLog(
                source_file_id=sf.id, person_id=person_id,
                worksheet_name=ws_name, target_table=mapped_table,
                rows_in_sheet=rows, rows_inserted=rows,
                columns_in_sheet=0, columns_mapped=0,
                status="ok", ingested_at=datetime.now(),
            ))
        except Exception as e:
            results.append({"name": ws_name, "table": mapped_table, "rows": 0, "status": "error", "error": str(e)})

    db.commit()
    return {"status": "ok", "file_name": file_name, "total_imported": total_imported, "worksheets": results}


@router.delete("/person/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    for model in TABLE_MODELS.values():
        if hasattr(model, 'person_id'):
            db.query(model).filter(model.person_id == person_id).delete()

    db.query(IngestionLog).filter(IngestionLog.person_id == person_id).delete()
    db.query(SourceFile).filter(SourceFile.person_id == person_id).delete()
    db.query(Person).filter(Person.id == person_id).delete()
    db.commit()

    return {"status": "ok", "message": f"Person '{person.full_name}' and all data deleted"}


@router.get("/ingestion-log")
def get_ingestion_log(
    person_id: int = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db),
):
    base = db.query(IngestionLog)
    if person_id:
        base = base.filter(IngestionLog.person_id == person_id)
    logs = base.order_by(IngestionLog.ingested_at.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "person_id": log.person_id,
            "worksheet_name": log.worksheet_name,
            "target_table": log.target_table,
            "rows_in_sheet": log.rows_in_sheet,
            "rows_inserted": log.rows_inserted,
            "status": log.status,
            "error_message": log.error_message,
            "ingested_at": log.ingested_at.isoformat() if log.ingested_at else None,
        }
        for log in logs
    ]
