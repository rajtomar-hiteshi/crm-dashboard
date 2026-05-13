import re
import os
import logging
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials
from sqlalchemy.dialects.postgresql import insert
from dateutil import parser as date_parser

from database import SessionLocal
from models import (
    DailyActivity, LinkedinConnection, LinkedinFollowup, LinkedinInmail,
    PositiveResponseDetail, LeadPipeline, DataExtraction, EmailOutreach, SyncLog,
)

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

# ---------------------------------------------------------------------------
# Sheet configurations — one entry per spreadsheet
# Each has tab_configs mapping tab names to their sync type & column layout
# ---------------------------------------------------------------------------

SPREADSHEET_CONFIGS = [
    # ── Karishma (22 Apr 2026 - Current) ──
    {
        "employee": "Karishma",
        "sheet_id": "13S1qaUWgtuo1fAYpJIUxgG_YKrwnQe2tjlH8L3vAqTo",
        "source": "Karishma_APR2026_CURRENT",
        "tabs": {
            "Target Tracking": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "data_extraction": 4, "emails": 5,
                    "positive_responses": 6,
                },
            },
            "LinkedIn Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "cadence_sequence": 3,
                             "linkedin_account_used": 5, "filter_link": 6},
            },
            "LinkedIn Follow ups": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4, "message_sent": 5, "filter_link": 6, "cadence": 7},
            },
            "LinkedIn InMails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4, "filter_link": 5, "cadence": 6},
            },
            "Data Extraction": {
                "type": "data_extraction",
                "columns": {"date": 0, "client_linkedin_url": 2, "company_name": 3,
                             "likely_usecase": 4, "location": 5},
            },
            "Cold Emails": {
                "type": "email_outreach",
                "columns": {"date": 0, "client_name": 2, "client_linkedin_url": 3,
                             "client_email": 4, "email_draft": 5, "cadence": 6},
            },
            "Positive Responses": {
                "type": "positive_response",
                "format": "karishma_current",
                "columns": {"date": 0, "client_name": 1, "client_linkedin_url": 2,
                             "client_revert": 3, "linkedin_account": 4},
            },
        },
    },
    # ── Karishma (Jan 2 - 21 Apr 2026) ──
    {
        "employee": "Karishma",
        "sheet_id": "13DQIF2A1Tgow0_PVw1IJMQ5XvzA_VeitbVbCN606noU",
        "source": "Karishma_JAN_APR2026",
        "tabs": {
            "Target Tracking": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                    "cold_calling": 6, "follow_up_calls": 7,
                },
            },
            "Linkedin Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "connection_message": 4, "geography": 5, "company_size": 6, "industry": 7},
            },
            "Linkedin Follow ups": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4, "message_sent": 5},
            },
            "Linkedin Inmails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4},
            },
            "PR": {
                "type": "positive_response",
                "format": "pr_format",
                "columns": {"client_type": 0, "date": 1, "connected_date": 2,
                             "client_name": 3, "client_linkedin_url": 4, "first_followup_date": 5,
                             "num_followups": 6, "gap_days": 7, "quality": 8,
                             "client_revert": 9, "linkedin_account": 10},
            },
            "Sales Inquiry(2026)": {
                "type": "lead_pipeline",
                "format": "sales_inquiry",
                "columns": {"client_name": 1, "location": 2, "company": 3, "company_size": 4,
                             "client_designation": 5, "client_linkedin_url": 6, "client_email": 7,
                             "client_phone": 8, "summary": 9, "next_steps": 10, "zoho_link": 11,
                             "lead_date": 12, "lead_source": 13, "account": 14},
            },
        },
    },
    # ── Ragini (12 Jan 2026 - Current) ──
    {
        "employee": "Ragini",
        "sheet_id": "1Tl344h5Sn33cF5VlpZZmzP-a2bk1Bb7IN6-RBGTo_JM",
        "source": "Ragini_JAN2026_CURRENT",
        "tabs": {
            "Target Tracking": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                    "positive_responses": 6, "lead_generated": 7, "calls": 8,
                },
            },
            "LinkedIn Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "connection_message": 4},
            },
            "LinkedIn Follow Ups ": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4, "message_sent": 5},
            },
            "LinkedIn InMails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4},
            },
            "Emails": {
                "type": "email_outreach",
                "format": "ragini_emails",
                "header_row": 1,
                "columns": {"date": 0, "client_name": 2, "client_email": 3,
                             "client_linkedin_url": 8},
            },
            "New PR": {
                "type": "positive_response",
                "format": "pr_format",
                "columns": {"date": 0, "client_type": 1, "connected_date": 2,
                             "client_name": 3, "client_linkedin_url": 4, "first_followup_date": 5,
                             "num_followups": 6, "gap_days": 7, "quality": 8,
                             "client_revert": 9, "linkedin_account": 10},
            },
            "Old PR ": {
                "type": "positive_response",
                "format": "old_pr",
                "columns": {"date": 1, "client_name": 4, "lead_source": 5,
                             "linkedin_account": 6, "client_linkedin_url": 7,
                             "client_email": 8, "client_revert": 10},
            },
            "Lead Generated": {
                "type": "lead_pipeline",
                "format": "ragini_leads",
                "columns": {"lead_date": 0, "client_name": 2, "location": 3,
                             "company": 4, "company_size": 5, "client_designation": 6,
                             "client_linkedin_url": 7, "client_email": 8,
                             "summary": 10, "next_steps": 11, "lead_date_alt": 12,
                             "zoho_link": 13, "lead_source": 14},
            },
        },
    },
    # ── Yashika (Jan 2025 - Aug 2025) ──
    {
        "employee": "Yashika",
        "sheet_id": "1hf40HUOiqQG5Nk5ANrUlx1bbio4fuzQ-uF0MteZATbc",
        "source": "Yashika_2025",
        "tabs": {
            "Traget Tracking": {
                "type": "daily_activity",
                "format": "yashika_2025",
                "columns": {
                    "date": 2, "linkedin_connections": 4, "linkedin_follow_ups": 6,
                    "linkedin_inmails": 8, "emails": 10,
                },
            },
            "Linkedln Connection": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "connection_message": 5},
            },
            "Linkedln Follow up": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 1, "followup_type": 2,
                             "message_sent": 3, "linkedin_account_used": 4},
            },
            "Inmails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 1, "linkedin_account_used": 2,
                             "message_sent": 3},
            },
            "Positive Responses": {
                "type": "positive_response",
                "format": "yashika_2025_pr",
                "header_row": 1,
                "columns": {"date": 0, "client_name": 2, "lead_source": 3,
                             "linkedin_account": 4, "client_revert": 5,
                             "client_linkedin_url": 6, "quality": 7},
            },
            "presales": {
                "type": "lead_pipeline",
                "format": "yashika_presales",
                "columns": {"lead_date": 0, "client_name": 1, "location": 2,
                             "company": 3, "company_size": 4, "client_designation": 5,
                             "summary": 6, "client_linkedin_url": 7, "zoho_link": 8,
                             "account": 9},
            },
        },
    },
    # ── Yashika (Apr 4, 2026 - Current) ──
    {
        "employee": "Yashika",
        "sheet_id": "1DJRBExpAdYuQGX-Y_-IRGrEk5xT0ZVMDBQ8-D_YUAYs",
        "source": "Yashika_APR2026_CURRENT",
        "tabs": {
            "Target Tracking ": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                    "cold_calling": 6, "follow_up_calls": 7,
                },
            },
            "LinkedIn Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "cadence_sequence": 3,
                             "linkedin_account_used": 4, "filter_link": 5},
            },
            "LinkedIn Follow ups": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4, "message_sent": 5, "filter_link": 6, "cadence": 7},
            },
            "Linkedln Inmails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4, "filter_link": 5, "cadence": 6},
            },
            "Positive Response ": {
                "type": "positive_response",
                "format": "pr_format",
                "columns": {"client_type": 0, "date": 1, "connected_date": 2,
                             "client_name": 3, "client_linkedin_url": 4, "first_followup_date": 5,
                             "num_followups": 6, "gap_days": 7, "quality": 8,
                             "client_revert": 9},
            },
            "Lead Generated ": {
                "type": "lead_pipeline",
                "format": "sales_inquiry",
                "columns": {"client_name": 1, "location": 2, "company": 3, "company_size": 4,
                             "client_designation": 5, "client_linkedin_url": 6, "client_email": 7,
                             "client_phone": 8, "summary": 9, "next_steps": 10, "zoho_link": 11,
                             "lead_date": 12, "lead_source": 13, "account": 14},
            },
        },
    },
    # ── Yogita (6 Jan - 21 Apr 2026) ──
    {
        "employee": "Yogita",
        "sheet_id": "15wAch41nIISrgOWGxNb8oFEkqu3A1oWxWUXdykm4kb0",
        "source": "Yogita_JAN_APR2026",
        "tabs": {
            "Target Tracking": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                    "positive_responses": 6,
                },
            },
            "LinkedIn Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3},
            },
            "LinkedIn Follow ups": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4},
            },
            "LinkedIn InMails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4, "geography": 5, "company_size": 6, "industry": 7},
            },
            "Emails": {
                "type": "email_outreach",
                "columns": {"date": 0, "client_name": 1, "client_linkedin_url": 2,
                             "client_email": 3, "email_draft": 4},
            },
            "Positive Response": {
                "type": "positive_response",
                "format": "pr_format",
                "columns": {"date": 0, "connected_date": 1, "client_name": 2,
                             "client_linkedin_url": 3, "first_followup_date": 4,
                             "num_followups": 5, "gap_days": 6, "quality": 7,
                             "client_revert": 8},
            },
            "Lead Generated": {
                "type": "lead_pipeline",
                "format": "yogita_leads",
                "columns": {"lead_date": 0, "client_name": 1, "location": 2,
                             "company": 3, "company_size": 4, "client_designation": 5,
                             "client_linkedin_url": 6, "client_email": 7,
                             "client_phone": 8, "summary": 9, "next_steps": 10, "zoho_link": 11},
            },
        },
    },
    # ── Yogita (22 Apr 2026 - Current) ──
    {
        "employee": "Yogita",
        "sheet_id": "1DZC1kUfZuvuA579_TMRyb7aCVDfe3hK1a5X_YVJbJkE",
        "source": "Yogita_APR2026_CURRENT",
        "tabs": {
            "Target Tracking": {
                "type": "daily_activity",
                "columns": {
                    "date": 0, "linkedin_connections": 1, "linkedin_follow_ups": 2,
                    "linkedin_inmails": 3, "emails": 4, "data_extraction": 5,
                    "positive_responses": 6,
                },
            },
            "LinkedIn Connections": {
                "type": "linkedin_connection",
                "columns": {"date": 0, "client_linkedin_url": 2, "cadence_sequence": 3,
                             "linkedin_account_used": 4, "filter_link": 5},
            },
            "LinkedIn Follow ups": {
                "type": "linkedin_followup",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "followup_type": 4, "message_sent": 5, "filter_link": 6, "cadence": 7},
            },
            "LinkedIn InMails": {
                "type": "linkedin_inmail",
                "columns": {"date": 0, "client_linkedin_url": 2, "linkedin_account_used": 3,
                             "message_sent": 4, "filter_link": 5, "cadence": 6},
            },
            "Data Extraction": {
                "type": "data_extraction",
                "format": "yogita_de",
                "columns": {"date": 0, "client_name": 1, "client_designation": 2,
                             "company_name": 3, "location": 4, "client_email": 5,
                             "contact_number": 7, "industry": 8, "client_linkedin_url": 9},
            },
            "Positive Responses": {
                "type": "positive_response",
                "format": "pr_format",
                "columns": {"date": 0, "connected_date": 1, "client_name": 2,
                             "client_linkedin_url": 3, "first_followup_date": 4,
                             "num_followups": 5, "gap_days": 6, "quality": 7,
                             "client_revert": 8},
            },
            "Lead Generated": {
                "type": "lead_pipeline",
                "format": "yogita_leads",
                "columns": {"lead_date": 0, "client_name": 1, "location": 2,
                             "company": 3, "company_size": 4, "client_designation": 5,
                             "client_linkedin_url": 6, "client_email": 7,
                             "client_phone": 8, "summary": 9, "next_steps": 10, "zoho_link": 11},
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def safe_str(row, idx, max_len=5000):
    if idx is None or idx >= len(row):
        return None
    val = str(row[idx]).strip()
    if not val:
        return None
    return val[:max_len]


def get_gspread_client():
    creds = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
    return gspread.authorize(creds)


# ---------------------------------------------------------------------------
# Tab sync functions — one per type
# ---------------------------------------------------------------------------

def sync_daily_activity(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    date_fmt = tab_config.get("format", "standard")
    start_row = 1
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

        records.append({
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
        })
    return records


def sync_linkedin_connections(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    start_row = tab_config.get("header_row", 0) + 1
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols["date"]
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 10:
                break
            continue
        consecutive_empty = 0

        conn_date = parse_date(row[date_col], tab_config.get("format", "standard"))
        if conn_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "connection_date": conn_date,
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "linkedin_account_used": safe_str(row, cols.get("linkedin_account_used")),
            "cadence_sequence": safe_str(row, cols.get("cadence_sequence")),
            "connection_message": safe_str(row, cols.get("connection_message")),
            "filter_link": safe_str(row, cols.get("filter_link")),
            "geography": safe_str(row, cols.get("geography")),
            "company_size": safe_str(row, cols.get("company_size")),
            "industry": safe_str(row, cols.get("industry")),
            "source_file": config["source"],
        })
    return records


def sync_linkedin_followups(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    start_row = tab_config.get("header_row", 0) + 1
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols["date"]
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 10:
                break
            continue
        consecutive_empty = 0

        fu_date = parse_date(row[date_col], tab_config.get("format", "standard"))
        if fu_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "followup_date": fu_date,
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "linkedin_account_used": safe_str(row, cols.get("linkedin_account_used")),
            "followup_type": safe_str(row, cols.get("followup_type")),
            "message_sent": safe_str(row, cols.get("message_sent")),
            "filter_link": safe_str(row, cols.get("filter_link")),
            "cadence": safe_str(row, cols.get("cadence")),
            "source_file": config["source"],
        })
    return records


def sync_linkedin_inmails(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    start_row = tab_config.get("header_row", 0) + 1
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols["date"]
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 10:
                break
            continue
        consecutive_empty = 0

        im_date = parse_date(row[date_col], tab_config.get("format", "standard"))
        if im_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "inmail_date": im_date,
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "linkedin_account_used": safe_str(row, cols.get("linkedin_account_used")),
            "message_sent": safe_str(row, cols.get("message_sent")),
            "filter_link": safe_str(row, cols.get("filter_link")),
            "cadence": safe_str(row, cols.get("cadence")),
            "source_file": config["source"],
        })
    return records


def sync_positive_responses(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    fmt = tab_config.get("format", "standard")
    start_row = tab_config.get("header_row", 0) + 1
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols.get("date", 0)
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 5:
                break
            continue
        consecutive_empty = 0

        resp_date = parse_date(row[date_col])
        if resp_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "response_date": resp_date,
            "client_name": safe_str(row, cols.get("client_name")),
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "quality": safe_str(row, cols.get("quality")),
            "client_type": safe_str(row, cols.get("client_type")),
            "connected_date": safe_str(row, cols.get("connected_date")),
            "first_followup_date": safe_str(row, cols.get("first_followup_date")),
            "num_followups": safe_str(row, cols.get("num_followups")),
            "gap_days": safe_str(row, cols.get("gap_days")),
            "client_revert": safe_str(row, cols.get("client_revert")),
            "linkedin_account": safe_str(row, cols.get("linkedin_account")),
            "source_file": config["source"],
        })
    return records


def sync_lead_pipeline(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    fmt = tab_config.get("format", "standard")
    start_row = tab_config.get("header_row", 0) + 1
    consecutive_empty = 0

    for row_idx in range(start_row, len(all_values)):
        row = all_values[row_idx]
        date_col = cols.get("lead_date", 0)
        if date_col >= len(row) or not str(row[date_col]).strip():
            consecutive_empty += 1
            if consecutive_empty >= 5:
                break
            continue
        consecutive_empty = 0

        lead_date = parse_date(row[date_col])
        if lead_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "lead_date": lead_date,
            "client_name": safe_str(row, cols.get("client_name")),
            "company": safe_str(row, cols.get("company")),
            "location": safe_str(row, cols.get("location")),
            "company_size": safe_str(row, cols.get("company_size")),
            "client_designation": safe_str(row, cols.get("client_designation")),
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "client_email": safe_str(row, cols.get("client_email")),
            "client_phone": safe_str(row, cols.get("client_phone")),
            "summary": safe_str(row, cols.get("summary")),
            "next_steps": safe_str(row, cols.get("next_steps")),
            "zoho_link": safe_str(row, cols.get("zoho_link")),
            "lead_source": safe_str(row, cols.get("lead_source")),
            "account": safe_str(row, cols.get("account")),
            "source_file": config["source"],
        })
    return records


def sync_data_extraction(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    start_row = tab_config.get("header_row", 0) + 1
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

        ext_date = parse_date(row[date_col])
        if ext_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "extraction_date": ext_date,
            "client_name": safe_str(row, cols.get("client_name")),
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "company_name": safe_str(row, cols.get("company_name")),
            "likely_usecase": safe_str(row, cols.get("likely_usecase")),
            "location": safe_str(row, cols.get("location")),
            "client_email": safe_str(row, cols.get("client_email")),
            "contact_number": safe_str(row, cols.get("contact_number")),
            "industry": safe_str(row, cols.get("industry")),
            "source_file": config["source"],
        })
    return records


def sync_email_outreach(all_values, config, tab_config):
    records = []
    cols = tab_config["columns"]
    start_row = tab_config.get("header_row", 0) + 1
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

        em_date = parse_date(row[date_col])
        if em_date is None:
            continue

        records.append({
            "employee_name": config["employee"],
            "email_date": em_date,
            "client_name": safe_str(row, cols.get("client_name")),
            "client_linkedin_url": safe_str(row, cols.get("client_linkedin_url")),
            "client_email": safe_str(row, cols.get("client_email")),
            "email_draft": safe_str(row, cols.get("email_draft")),
            "cadence": safe_str(row, cols.get("cadence")),
            "source_file": config["source"],
        })
    return records


SYNC_FUNCTIONS = {
    "daily_activity": sync_daily_activity,
    "linkedin_connection": sync_linkedin_connections,
    "linkedin_followup": sync_linkedin_followups,
    "linkedin_inmail": sync_linkedin_inmails,
    "positive_response": sync_positive_responses,
    "lead_pipeline": sync_lead_pipeline,
    "data_extraction": sync_data_extraction,
    "email_outreach": sync_email_outreach,
}

MODEL_MAP = {
    "daily_activity": DailyActivity,
    "linkedin_connection": LinkedinConnection,
    "linkedin_followup": LinkedinFollowup,
    "linkedin_inmail": LinkedinInmail,
    "positive_response": PositiveResponseDetail,
    "lead_pipeline": LeadPipeline,
    "data_extraction": DataExtraction,
    "email_outreach": EmailOutreach,
}


# ---------------------------------------------------------------------------
# Upsert / insert logic
# ---------------------------------------------------------------------------

def upsert_daily_activity(db, records):
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


def bulk_insert(db, model_class, records, source_file=None):
    if not records:
        return 0
    if source_file:
        db.query(model_class).filter(model_class.source_file == source_file).delete()
    db.bulk_insert_mappings(model_class, records)
    db.commit()
    return len(records)


# ---------------------------------------------------------------------------
# Main sync orchestrator
# ---------------------------------------------------------------------------

def run_sync():
    db = SessionLocal()
    total_records = 0
    status = "success"
    message = ""

    try:
        gc = get_gspread_client()

        for config in SPREADSHEET_CONFIGS:
            try:
                spreadsheet = gc.open_by_key(config["sheet_id"])
                available_tabs = {ws.title: ws for ws in spreadsheet.worksheets()}
            except Exception as e:
                logger.error(f"Error opening spreadsheet {config['source']}: {e}")
                message += f"Error opening {config['source']}: {str(e)}; "
                continue

            for tab_name, tab_config in config["tabs"].items():
                tab_source = f"{config['source']}::{tab_name}"
                worksheet = available_tabs.get(tab_name)
                if worksheet is None:
                    logger.warning(f"Tab '{tab_name}' not found in {config['source']}, skipping")
                    continue

                try:
                    all_values = worksheet.get_all_values()
                    sync_type = tab_config["type"]
                    sync_fn = SYNC_FUNCTIONS[sync_type]
                    records = sync_fn(all_values, config, tab_config)

                    if sync_type == "daily_activity":
                        count = upsert_daily_activity(db, records)
                    else:
                        model_class = MODEL_MAP[sync_type]
                        count = bulk_insert(db, model_class, records, source_file=config["source"])

                    total_records += count
                    logger.info(f"Synced {count} records from {tab_source}")
                except Exception as e:
                    logger.error(f"Error syncing {tab_source}: {e}")
                    message += f"Error in {tab_source}: {str(e)}; "

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


def run_sync_tab_type(tab_type):
    """Sync only a specific tab type across all spreadsheets."""
    db = SessionLocal()
    total_records = 0
    status = "success"
    message = ""

    try:
        gc = get_gspread_client()

        for config in SPREADSHEET_CONFIGS:
            try:
                spreadsheet = gc.open_by_key(config["sheet_id"])
                available_tabs = {ws.title: ws for ws in spreadsheet.worksheets()}
            except Exception as e:
                logger.error(f"Error opening spreadsheet {config['source']}: {e}")
                message += f"Error opening {config['source']}: {str(e)}; "
                continue

            for tab_name, tab_config in config["tabs"].items():
                if tab_config["type"] != tab_type:
                    continue

                tab_source = f"{config['source']}::{tab_name}"
                worksheet = available_tabs.get(tab_name)
                if worksheet is None:
                    continue

                try:
                    all_values = worksheet.get_all_values()
                    sync_fn = SYNC_FUNCTIONS[tab_type]
                    records = sync_fn(all_values, config, tab_config)

                    if tab_type == "daily_activity":
                        count = upsert_daily_activity(db, records)
                    else:
                        model_class = MODEL_MAP[tab_type]
                        count = bulk_insert(db, model_class, records, source_file=config["source"])

                    total_records += count
                    logger.info(f"Synced {count} records from {tab_source}")
                except Exception as e:
                    logger.error(f"Error syncing {tab_source}: {e}")
                    message += f"Error in {tab_source}: {str(e)}; "

        if message:
            status = "partial"
        else:
            message = f"Successfully synced {total_records} {tab_type} records"

    except Exception as e:
        status = "error"
        message = str(e)
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
