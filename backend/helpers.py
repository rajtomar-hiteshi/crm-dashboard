PERSON_COLORS = {
    "Yogita": "#3B82F6",
    "Karishma": "#06B6D4",
    "Ragini": "#10B981",
    "Yashika": "#8B5CF6",
}


def safe_int(val):
    if val is None:
        return 0
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return 0
