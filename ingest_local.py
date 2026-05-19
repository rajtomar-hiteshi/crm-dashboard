#!/usr/bin/env python3
"""One-time local file ingestion for cleaned xlsx files."""
import sys, os, json
sys.path.insert(0, '/home/ec2-user/leadgen-crm')

import openpyxl
from datetime import datetime, date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.services.sync_service import (
    route_worksheet, read_worksheet_data, map_row, map_row_positional,
    COLUMN_MAP_REGISTRY, TABLE_COLS, DATE_COL, TARGET_TRACKING_SKIP,
    RAGINI_LEADS_POSITIONAL, is_single_column_tracker, is_ragini_leads_no_header,
    parse_date, cell_to_str, norm, _batch_insert
)

DB_URL = "postgresql://postgres:postgres@localhost:5432/leadgen_crm"
UPLOADS = "/home/ec2-user/leadgen-crm/uploads"

FILES = {
    "Karishma.xlsx": "Karishma",
    "Ragini.xlsx":   "Ragini",
    "Seema.xlsx":    "Seema",
    "Umair.xlsx":    "Umair",
    "Yashika.xlsx":  "Yashika",
}

TABLES_TO_CLEAN = [
    "target_tracking", "linkedin_connections", "linkedin_followups",
    "linkedin_inmails", "emails", "data_extraction",
    "positive_responses", "leads_generated", "other_worksheet_data",
]

engine = create_engine(DB_URL)
DBSession = sessionmaker(bind=engine)
db = DBSession()


def get_counts(person_ids):
    counts = {}
    pid_list = ",".join(str(p) for p in person_ids)
    for tbl in TABLES_TO_CLEAN:
        rows = db.execute(text(
            f"SELECT person_id, COUNT(*) FROM {tbl} WHERE person_id IN ({pid_list}) GROUP BY person_id"
        )).fetchall()
        for pid, cnt in rows:
            counts[(tbl, pid)] = cnt
    return counts


# == Step 1: Ensure all persons exist ==
print("=" * 60)
print("STEP 1: Checking persons...")
person_map = {}
for fname, short in FILES.items():
    row = db.execute(text("SELECT id, full_name FROM persons WHERE short_name = :sn"), {"sn": short}).fetchone()
    if row:
        person_map[short] = row[0]
        print(f"  OK {short} exists (id={row[0]}, {row[1]})")
    else:
        db.execute(text("INSERT INTO persons (full_name, short_name) VALUES (:fn, :sn)"), {"fn": short, "sn": short})
        db.commit()
        row = db.execute(text("SELECT id FROM persons WHERE short_name = :sn"), {"sn": short}).fetchone()
        person_map[short] = row[0]
        print(f"  ++ Created {short} (id={row[0]})")


# == Step 2: Create source_file records ==
print("\nSTEP 2: Creating source_file records...")
sf_map = {}
for fname, short in FILES.items():
    pid = person_map[short]
    sf_name = f"[Local Upload] {fname}"
    existing = db.execute(text(
        "SELECT id FROM source_files WHERE file_name = :fn AND person_id = :pid"
    ), {"fn": sf_name, "pid": pid}).fetchone()
    if existing:
        sf_map[short] = existing[0]
        print(f"  OK {short} source_file exists (id={existing[0]})")
    else:
        db.execute(text(
            "INSERT INTO source_files (person_id, file_name, drive_file_id, file_type, ingested_at) "
            "VALUES (:pid, :fn, :did, 'CURRENT', NOW())"
        ), {"pid": pid, "fn": sf_name, "did": f"local_{short.lower()}"})
        db.commit()
        row = db.execute(text("SELECT id FROM source_files WHERE file_name = :fn AND person_id = :pid"),
                         {"fn": sf_name, "pid": pid}).fetchone()
        sf_map[short] = row[0]
        print(f"  ++ Created source_file for {short} (id={row[0]})")


# == Step 3: BEFORE counts ==
all_pids = list(person_map.values())
print("\nSTEP 3: BEFORE counts...")
before = get_counts(all_pids)
for tbl in TABLES_TO_CLEAN:
    for short, pid in sorted(person_map.items()):
        cnt = before.get((tbl, pid), 0)
        if cnt > 0:
            print(f"  {tbl:25s} | {short:10s} | {cnt:,} rows")


# == Step 4: Delete old CURRENT data for these persons ==
print("\nSTEP 4: Deleting old CURRENT data (NOT Yogita)...")
for short, pid in person_map.items():
    sf_ids = db.execute(text(
        "SELECT id FROM source_files WHERE person_id = :pid AND file_type = 'CURRENT'"
    ), {"pid": pid}).fetchall()
    sf_id_list = [r[0] for r in sf_ids]
    if not sf_id_list:
        print(f"  No CURRENT source files for {short}, skipping delete")
        continue
    sf_str = ",".join(str(s) for s in sf_id_list)
    total_deleted = 0
    for tbl in TABLES_TO_CLEAN:
        result = db.execute(text(
            f"DELETE FROM {tbl} WHERE person_id = :pid AND source_file_id IN ({sf_str})"
        ), {"pid": pid})
        if result.rowcount > 0:
            print(f"  Deleted {result.rowcount:,} rows from {tbl} for {short}")
            total_deleted += result.rowcount
    # Also delete legacy rows with no source_file_id
    for tbl in TABLES_TO_CLEAN:
        result = db.execute(text(
            f"DELETE FROM {tbl} WHERE person_id = :pid AND source_file_id IS NULL"
        ), {"pid": pid})
        if result.rowcount > 0:
            print(f"  Deleted {result.rowcount:,} legacy rows from {tbl} for {short}")
            total_deleted += result.rowcount
    if total_deleted == 0:
        print(f"  No existing data for {short}")
db.commit()
print("  Done deleting.")


# == Step 5: Ingest each file ==
print("\nSTEP 5: Ingesting files...")
grand_total = 0

for fname, short in FILES.items():
    filepath = os.path.join(UPLOADS, fname)
    pid = person_map[short]
    sf_id = sf_map[short]
    person_name = short

    print(f"\n  --- {fname} (person={short}, pid={pid}, sf_id={sf_id}) ---")

    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    file_total = 0

    for ws_name in wb.sheetnames:
        ws = wb[ws_name]
        headers_raw, data_rows = read_worksheet_data(ws)
        target_table = route_worksheet(ws_name)

        if not data_rows:
            continue

        if is_single_column_tracker(headers_raw):
            target_table = 'other_worksheet_data'

        if target_table == 'other_worksheet_data':
            ws_new = 0
            for row_num, row in enumerate(data_rows, start=2):
                row_dict = {}
                for i, val in enumerate(row):
                    key = str(headers_raw[i]).strip() if i < len(headers_raw) and headers_raw[i] else f"col_{i}"
                    if val is not None and str(val).strip():
                        row_dict[key] = str(val).strip()
                if row_dict:
                    db.execute(text(
                        "INSERT INTO other_worksheet_data (person_id, source_file_id, original_worksheet, row_number, row_data) "
                        "VALUES (:pid, :sfid, :ws, :rn, :rd)"
                    ), {"pid": pid, "sfid": sf_id, "ws": ws_name, "rn": row_num, "rd": json.dumps(row_dict)})
                    ws_new += 1
            if ws_new > 0:
                db.commit()
                print(f"    {ws_name} -> other_worksheet_data: {ws_new:,} rows")
                file_total += ws_new
            continue

        col_map = COLUMN_MAP_REGISTRY.get(target_table, {})
        use_positional = is_ragini_leads_no_header(ws_name, person_name, headers_raw)
        if use_positional:
            data_rows = [list(headers_raw)] + data_rows

        cols = TABLE_COLS[target_table]
        date_col_info = DATE_COL.get(target_table)
        ws_new = 0
        batch = []

        for row in data_rows:
            if use_positional:
                mapped = map_row_positional(row, RAGINI_LEADS_POSITIONAL)
            else:
                skip = TARGET_TRACKING_SKIP if target_table == 'target_tracking' else set()
                mapped = map_row(headers_raw, row, col_map, skip_cols=skip)

            if not mapped or all(v is None for v in mapped.values()):
                continue

            if date_col_info:
                date_col, raw_col = date_col_info
                raw_val = mapped.get(date_col)
                if raw_val is not None:
                    parsed_dt, raw_str = parse_date(raw_val)
                    # Skip rows with future dates (beyond today)
                    if parsed_dt and parsed_dt > date.today():
                        continue
                    mapped[date_col] = str(parsed_dt) if parsed_dt else None
                    mapped[raw_col] = raw_str
                else:
                    mapped[raw_col] = None
                if mapped.get(date_col) is None:
                    continue

            mapped['person_id'] = pid
            mapped['source_file_id'] = sf_id
            mapped['original_worksheet'] = ws_name

            values = tuple(mapped.get(c) for c in cols)
            batch.append(values)
            ws_new += 1

            if len(batch) >= 500:
                _batch_insert(db, target_table, cols, batch)
                batch = []

        if batch:
            _batch_insert(db, target_table, cols, batch)

        if ws_new > 0:
            db.commit()
            print(f"    {ws_name} -> {target_table}: {ws_new:,} rows")

        file_total += ws_new

    wb.close()
    grand_total += file_total
    print(f"  DONE {fname}: {file_total:,} total rows")


# == Step 6: AFTER counts ==
print("\n" + "=" * 60)
print("STEP 6: AFTER counts (comparison)...")
after = get_counts(all_pids)
print(f"\n  {'Table':25s} | {'Employee':10s} | {'Before':>8s} | {'After':>8s} | {'Change':>8s}")
print("  " + "-" * 72)
for tbl in TABLES_TO_CLEAN:
    for short, pid in sorted(person_map.items()):
        b = before.get((tbl, pid), 0)
        a = after.get((tbl, pid), 0)
        if b > 0 or a > 0:
            diff = a - b
            sign = "+" if diff > 0 else ""
            print(f"  {tbl:25s} | {short:10s} | {b:>8,} | {a:>8,} | {sign}{diff:>7,}")

print(f"\n{'=' * 60}")
print(f"GRAND TOTAL: {grand_total:,} rows ingested across all files")
print(f"{'=' * 60}")

db.close()
