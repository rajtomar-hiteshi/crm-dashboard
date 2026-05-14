"""
One-time migration: adds new columns to existing tables and creates new tables.
Run this before starting the server after the model update.
"""
from sqlalchemy import text
from database import engine, Base
import models  # noqa: F401 — ensures all models are registered

NEW_COLUMNS = {
    "persons": [
        ("role", "VARCHAR DEFAULT 'Lead Gen Executive'"),
    ],
    "positive_responses_detail": [
        ("client_linkedin_url", "VARCHAR"),
        ("client_type", "VARCHAR"),
        ("connected_date", "VARCHAR"),
        ("first_followup_date", "VARCHAR"),
        ("num_followups", "VARCHAR"),
        ("gap_days", "VARCHAR"),
        ("client_revert", "TEXT"),
        ("linkedin_account", "VARCHAR"),
        ("source_file", "VARCHAR"),
    ],
    "leads_pipeline": [
        ("company_size", "VARCHAR"),
        ("client_designation", "VARCHAR"),
        ("client_linkedin_url", "VARCHAR"),
        ("client_email", "VARCHAR"),
        ("client_phone", "VARCHAR"),
        ("summary", "TEXT"),
        ("next_steps", "TEXT"),
        ("zoho_link", "VARCHAR"),
        ("lead_source", "VARCHAR"),
        ("account", "VARCHAR"),
        ("source_file", "VARCHAR"),
    ],
}


def run_migration():
    with engine.connect() as conn:
        for table, columns in NEW_COLUMNS.items():
            for col_name, col_type in columns:
                try:
                    conn.execute(text(
                        f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_name} {col_type}'
                    ))
                    print(f"  Added {table}.{col_name}")
                except Exception as e:
                    print(f"  Skipped {table}.{col_name}: {e}")
            conn.commit()

    Base.metadata.create_all(bind=engine)
    print("All new tables created (if not existing).")


if __name__ == "__main__":
    run_migration()
