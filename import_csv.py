import os
import re
import csv
import sys
from datetime import datetime
from dateutil import parser as date_parser
import psycopg2

sys.stdout.reconfigure(encoding="utf-8")

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "leadgen_crm",
    "user": "postgres",
    "password": "postgres",
}

CSV_DIR = os.path.join(os.path.dirname(__file__), "csv")

UPSERT_SQL = """
INSERT INTO daily_activity (
    employee_name, activity_date, linkedin_connections, linkedin_follow_ups,
    linkedin_inmails, emails, data_extraction, positive_responses,
    lead_generated, cold_calling, follow_up_calls, calls, source_file
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (employee_name, activity_date) DO UPDATE SET
    linkedin_connections = EXCLUDED.linkedin_connections,
    linkedin_follow_ups = EXCLUDED.linkedin_follow_ups,
    linkedin_inmails = EXCLUDED.linkedin_inmails,
    emails = EXCLUDED.emails,
    data_extraction = EXCLUDED.data_extraction,
    positive_responses = EXCLUDED.positive_responses,
    lead_generated = EXCLUDED.lead_generated,
    cold_calling = EXCLUDED.cold_calling,
    follow_up_calls = EXCLUDED.follow_up_calls,
    calls = EXCLUDED.calls,
    source_file = EXCLUDED.source_file,
    updated_at = NOW()
"""


def extract_number(value):
    if value is None:
        return 0
    s = str(value).strip()
    if not s:
        return 0
    if s.lower() in ("leave", "absent", "holiday", "off", "-", "n/a"):
        return 0
    match = re.match(r"(\d+)", s)
    if match:
        return int(match.group(1))
    return 0


def parse_date(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # DD-MM-YYYY or DD/MM/YYYY
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # "January 2, 2025" style
    try:
        return date_parser.parse(s).date()
    except (ValueError, TypeError):
        return None


def get_cell(row, idx):
    if idx < len(row):
        return row[idx]
    return ""


def import_standard(cur, filepath, employee, source, col_map):
    """col_map: dict mapping field name -> column index"""
    rows_imported = 0
    consecutive_empty = 0

    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)  # skip header

        for row in reader:
            date_val = get_cell(row, col_map["date"])
            if not str(date_val).strip():
                consecutive_empty += 1
                if consecutive_empty >= 5:
                    break
                continue
            consecutive_empty = 0

            activity_date = parse_date(date_val)
            if activity_date is None:
                continue

            cur.execute(UPSERT_SQL, (
                employee,
                activity_date,
                extract_number(get_cell(row, col_map.get("linkedin_connections", -1))) if "linkedin_connections" in col_map else 0,
                extract_number(get_cell(row, col_map.get("linkedin_follow_ups", -1))) if "linkedin_follow_ups" in col_map else 0,
                extract_number(get_cell(row, col_map.get("linkedin_inmails", -1))) if "linkedin_inmails" in col_map else 0,
                extract_number(get_cell(row, col_map.get("emails", -1))) if "emails" in col_map else 0,
                extract_number(get_cell(row, col_map.get("data_extraction", -1))) if "data_extraction" in col_map else 0,
                extract_number(get_cell(row, col_map.get("positive_responses", -1))) if "positive_responses" in col_map else 0,
                extract_number(get_cell(row, col_map.get("lead_generated", -1))) if "lead_generated" in col_map else 0,
                extract_number(get_cell(row, col_map.get("cold_calling", -1))) if "cold_calling" in col_map else 0,
                extract_number(get_cell(row, col_map.get("follow_up_calls", -1))) if "follow_up_calls" in col_map else 0,
                extract_number(get_cell(row, col_map.get("calls", -1))) if "calls" in col_map else 0,
                source,
            ))
            rows_imported += 1

    return rows_imported


def import_yashika_2025(cur, filepath):
    rows_imported = 0
    consecutive_empty = 0

    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader, None)  # skip header

        for row in reader:
            date_val = get_cell(row, 2)
            if not str(date_val).strip():
                consecutive_empty += 1
                if consecutive_empty >= 5:
                    break
                continue
            consecutive_empty = 0

            activity_date = parse_date(date_val)
            if activity_date is None:
                continue

            cur.execute(UPSERT_SQL, (
                "Yashika",
                activity_date,
                extract_number(get_cell(row, 4)),
                extract_number(get_cell(row, 6)),
                extract_number(get_cell(row, 8)),
                extract_number(get_cell(row, 10)),
                0,  # data_extraction
                0,  # positive_responses
                0,  # lead_generated
                0,  # cold_calling
                0,  # follow_up_calls
                0,  # calls
                "yashika_2025",
            ))
            rows_imported += 1

    return rows_imported


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    files = [
        {
            "file": "yogita_hist.csv",
            "employee": "Yogita",
            "source": "yogita_historical",
            "label": "Yogita historical",
            "col_map": {
                "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                "positive_responses": 6,
            },
        },
        {
            "file": "karishma_hist.csv",
            "employee": "Karishma",
            "source": "karishma_historical",
            "label": "Karishma historical",
            "col_map": {
                "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                "cold_calling": 6, "follow_up_calls": 7,
            },
        },
        {
            "file": "yashika_hust_2026.csv",
            "employee": "Yashika",
            "source": "yashika_hist_2026",
            "label": "Yashika hist 2026",
            "col_map": {
                "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                "cold_calling": 6, "follow_up_calls": 7,
            },
        },
    ]

    total = 0

    for f in files:
        filepath = os.path.join(CSV_DIR, f["file"])
        count = import_standard(cur, filepath, f["employee"], f["source"], f["col_map"])
        total += count
        print(f"✅ {f['label']}: {count} rows")

    # Yashika 2025 special format
    filepath = os.path.join(CSV_DIR, "yashika_2025.csv")
    count = import_yashika_2025(cur, filepath)
    total += count
    print(f"✅ Yashika 2025: {count} rows")

    conn.commit()
    cur.close()
    conn.close()

    print(f"🎉 Total: {total} rows imported")


if __name__ == "__main__":
    main()
