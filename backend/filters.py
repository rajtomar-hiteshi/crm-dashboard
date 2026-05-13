from datetime import date
import logging

logger = logging.getLogger(__name__)


def apply_filters(query, employee_col, date_col, employee=None, start_date=None, end_date=None):
    if employee and employee != "all":
        query = query.filter(employee_col == employee)
    if start_date:
        try:
            query = query.filter(date_col >= date.fromisoformat(start_date))
        except (ValueError, TypeError):
            logger.warning(f"Invalid start_date: {start_date}")
    if end_date:
        try:
            query = query.filter(date_col <= date.fromisoformat(end_date))
        except (ValueError, TypeError):
            logger.warning(f"Invalid end_date: {end_date}")
    return query
