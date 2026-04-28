from datetime import datetime
from zoneinfo import ZoneInfo

PRACTICE_TZ = ZoneInfo("America/Denver")

OPEN_HOUR = 8
CLOSE_HOUR = 17
LUNCH_START_HOUR = 12
LUNCH_END_HOUR = 13


def is_off_hours() -> bool:
    now = datetime.now(PRACTICE_TZ)
    weekday = now.weekday()
    hour = now.hour

    if weekday in (5, 6):
        return True

    if hour < OPEN_HOUR or hour >= CLOSE_HOUR:
        return True

    if LUNCH_START_HOUR <= hour < LUNCH_END_HOUR:
        return True

    return False


def get_time_period() -> str:
    now = datetime.now(PRACTICE_TZ)
    weekday = now.weekday()
    hour = now.hour

    if weekday in (5, 6) or hour < OPEN_HOUR or hour >= CLOSE_HOUR:
        return "after_hours"

    if LUNCH_START_HOUR <= hour < LUNCH_END_HOUR:
        return "lunch"

    return "regular"
