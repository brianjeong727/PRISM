import os
from datetime import datetime, timedelta, timezone
from typing import Tuple

import psycopg

from incidents.models import Unit

THRESHOLD = 2
STATUS_AVAILABLE = "AVAILABLE"
STATUS_ENROUTE = "ENROUTE"


def get_db_conn():
    return psycopg.connect(
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        sslmode="require",
    )


def forecast_ambulance_low(
    *,
    window_min: int = 120,
    horizon_min: int = 180,
) -> Tuple[bool, str]:
    available_now = Unit.objects.filter(
        unit_type=Unit.UnitType.AMBULANCE,
        status=Unit.Status.AVAILABLE,
    ).count()

    total = Unit.objects.filter(unit_type=Unit.UnitType.AMBULANCE).count()

    if available_now <= THRESHOLD:
        return True, f"LOW NOW: Only {available_now} ambulances AVAILABLE (threshold={THRESHOLD})."

    since = datetime.now(timezone.utc) - timedelta(minutes=window_min)

    sql = """
        SELECT COUNT(*) AS cnt
        FROM incidents_logentry
        WHERE created_at >= %s
          AND from_status = %s
          AND to_status = %s
    """

    try:
        with get_db_conn() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(sql, (since, STATUS_AVAILABLE, STATUS_ENROUTE))
                row = cur.fetchone() or {"cnt": 0}
        count = int(row["cnt"])
    except Exception:
        count = 0

    if count == 0:
        return False, (
            f"OK: {available_now} ambulances AVAILABLE (total={total}). "
            "No recent consumption detected."
        )

    hours = max(window_min / 60.0, 1e-6)
    rate = count / hours
    minutes_to_threshold = int(((available_now - THRESHOLD) / rate) * 60)

    if minutes_to_threshold <= horizon_min:
        return True, (
            f"FORECAST LOW: {available_now} AVAILABLE now; projected to reach ≤ {THRESHOLD} "
            f"in ~{minutes_to_threshold} minutes."
        )

    return False, (
        f"OK: {available_now} ambulances AVAILABLE (total={total}). "
        f"Estimated time to threshold: ~{minutes_to_threshold} minutes."
    )
