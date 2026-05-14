from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

PERIOD_PRESETS = {
    "today", "yesterday", "this_week", "last_week",
    "this_month", "last_month", "this_quarter", "last_quarter",
    "this_year", "last_year", "all_time", "custom",
}


def resolve_period(period: str):
    if not period or period in ("all_time", "all", "custom"):
        return None, None

    today = date.today()

    if period == "today":
        return today, today

    if period == "yesterday":
        y = today - timedelta(days=1)
        return y, y

    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, today

    if period == "last_week":
        end = today - timedelta(days=today.weekday()) - timedelta(days=1)
        start = end - timedelta(days=6)
        return start, end

    if period == "this_month":
        return today.replace(day=1), today

    if period == "last_month":
        first_of_this = today.replace(day=1)
        end = first_of_this - timedelta(days=1)
        start = end.replace(day=1)
        return start, end

    if period == "this_quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=q_start_month, day=1), today

    if period == "last_quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        q_start = today.replace(month=q_start_month, day=1)
        end = q_start - timedelta(days=1)
        lq_start_month = ((end.month - 1) // 3) * 3 + 1
        start = end.replace(month=lq_start_month, day=1)
        return start, end

    if period == "this_year":
        return today.replace(month=1, day=1), today

    if period == "last_year":
        start = today.replace(year=today.year - 1, month=1, day=1)
        end = today.replace(year=today.year - 1, month=12, day=31)
        return start, end

    return None, None


def apply_filters(query, person_id_col, date_col, employee=None,
                  start_date=None, end_date=None, period=None, **_kwargs):
    if employee and employee != "all":
        try:
            query = query.filter(person_id_col == int(employee))
        except (ValueError, TypeError):
            pass

    p_start, p_end = resolve_period(period) if period else (None, None)
    d_start = p_start or (_parse_date(start_date) if start_date else None)
    d_end = p_end or (_parse_date(end_date) if end_date else None)

    if d_start:
        query = query.filter(date_col >= d_start)
    if d_end:
        query = query.filter(date_col <= d_end)

    return query


def _parse_date(val):
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except (ValueError, TypeError):
        logger.warning(f"Invalid date: {val}")
        return None
