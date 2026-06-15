import os
from datetime import datetime, timedelta, timezone
from typing import Tuple

THRESHOLD = 2
STATUS_AVAILABLE = "AVAILABLE"
STATUS_ENROUTE = "ENROUTE"


def forecast_ambulance_low(
    *,
    window_min: int = 120,
    horizon_min: int = 180,
) -> Tuple[bool, str]:
    from supabase import create_client

    url = os.getenv("SUPABASE_URL", "https://jzwqzwkuduxrictkuxcx.supabase.co")
    key = os.getenv("SUPABASE_KEY", "")
    sb = create_client(url, key)

    avail = sb.table("incidents_unit").select("id", count="exact").eq("unit_type", "AMB").eq("status", STATUS_AVAILABLE).execute()
    available_now = avail.count or 0

    total_res = sb.table("incidents_unit").select("id", count="exact").eq("unit_type", "AMB").execute()
    total = total_res.count or 0

    if available_now <= THRESHOLD:
        return True, f"LOW NOW: Only {available_now} ambulances AVAILABLE (threshold={THRESHOLD})."

    since = (datetime.now(timezone.utc) - timedelta(minutes=window_min)).isoformat()

    try:
        log_res = (
            sb.table("incidents_logentry")
            .select("id", count="exact")
            .gte("created_at", since)
            .eq("from_status", STATUS_AVAILABLE)
            .eq("to_status", STATUS_ENROUTE)
            .execute()
        )
        count = log_res.count or 0
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
