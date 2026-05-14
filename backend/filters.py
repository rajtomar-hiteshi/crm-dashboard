from datetime import date
import logging

logger = logging.getLogger(__name__)

_name_to_id_cache = {}


def _resolve_person_id(db, employee):
    """Resolve employee name or id string to integer person_id."""
    try:
        return int(employee)
    except (ValueError, TypeError):
        pass
    if employee in _name_to_id_cache:
        return _name_to_id_cache[employee]
    from models import Person
    person = db.query(Person).filter(Person.short_name == employee).first()
    if person:
        _name_to_id_cache[employee] = person.id
        return person.id
    logger.warning(f"Could not resolve employee: {employee}")
    return None


def apply_filters(query, person_id_col, date_col, employee=None, start_date=None, end_date=None, db=None):
    if employee and employee != "all":
        pid = _resolve_person_id(db, employee) if db else None
        if pid is None:
            try:
                pid = int(employee)
            except (ValueError, TypeError):
                pass
        if pid is not None:
            query = query.filter(person_id_col == pid)
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
