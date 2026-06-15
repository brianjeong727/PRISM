import json
import os

from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jzwqzwkuduxrictkuxcx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

VALID_STATUSES = {"AVAILABLE", "ENROUTE", "ON_SCENE", "TRANSPORTING"}
VALID_UNIT_TYPES = {"AMB", "ENG"}


def _sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def units_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    sb = _sb()
    q = sb.table("incidents_unit").select("id,name,unit_type,status").order("unit_type").order("name")

    unit_type = request.GET.get("unit_type")
    status = request.GET.get("status")
    if unit_type:
        q = q.eq("unit_type", unit_type)
    if status:
        q = q.eq("status", status)

    result = q.execute()
    return JsonResponse(result.data or [], safe=False)


@csrf_exempt
def unit_set_status(request, unit_id: int):
    if request.method != "PATCH":
        return HttpResponseNotAllowed(["PATCH"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    new_status = payload.get("status")
    if not new_status:
        return JsonResponse({"error": "Missing 'status'"}, status=400)
    if new_status not in VALID_STATUSES:
        return JsonResponse({"error": f"Invalid status. Use one of: {sorted(VALID_STATUSES)}"}, status=400)

    sb = _sb()
    result = sb.table("incidents_unit").select("id,name,unit_type,status").eq("id", unit_id).execute()
    if not result.data:
        return JsonResponse({"error": "Unit not found"}, status=404)

    unit = result.data[0]
    old_status = unit["status"]

    if old_status != new_status:
        sb.table("incidents_unit").update({"status": new_status}).eq("id", unit_id).execute()
        sb.table("incidents_logentry").insert({
            "unit_id": unit_id,
            "from_status": old_status,
            "to_status": new_status,
        }).execute()
        unit["status"] = new_status

    return JsonResponse(unit)


def _format_request(r):
    assignments = r.get("incidents_requestassignment") or []
    return {
        "id": r["id"],
        "unit_type": r["unit_type"],
        "quantity": r["quantity"],
        "priority": r["priority"],
        "location": r["location"],
        "status": r["status"],
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
        "assignments": [{"id": a["id"], "unit_id": a["unit_id"]} for a in assignments],
    }


def requests_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    sb = _sb()
    q = (
        sb.table("incidents_resourcerequest")
        .select("*, incidents_requestassignment(id, unit_id)")
        .order("id", desc=True)
    )

    unit_type = request.GET.get("unit_type")
    status = request.GET.get("status")
    if unit_type:
        q = q.eq("unit_type", unit_type)
    if status:
        q = q.eq("status", status)

    result = q.execute()
    return JsonResponse([_format_request(r) for r in (result.data or [])], safe=False)


@csrf_exempt
def create_request(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    unit_type = payload.get("unit_type")
    quantity = payload.get("quantity")

    if not unit_type or quantity is None:
        return JsonResponse({"error": "unit_type and quantity required"}, status=400)
    if unit_type not in VALID_UNIT_TYPES:
        return JsonResponse({"error": f"Invalid unit_type. Use one of: {sorted(VALID_UNIT_TYPES)}"}, status=400)

    try:
        quantity = int(quantity)
        if quantity <= 0:
            raise ValueError()
    except ValueError:
        return JsonResponse({"error": "quantity must be a positive integer"}, status=400)

    sb = _sb()
    result = sb.table("incidents_resourcerequest").insert({
        "unit_type": unit_type,
        "quantity": quantity,
        "priority": payload.get("priority", "Medium"),
        "location": payload.get("location", ""),
        "status": "PENDING",
    }).execute()

    r = result.data[0]
    return JsonResponse({
        "id": r["id"],
        "unit_type": r["unit_type"],
        "quantity": r["quantity"],
        "priority": r["priority"],
        "location": r["location"],
        "status": r["status"],
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
        "assignments": [],
    }, status=201)


@csrf_exempt
def dispatch_request(request, request_id: int):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    unit_ids = payload.get("unit_ids", [])
    if not isinstance(unit_ids, list) or len(unit_ids) == 0:
        return JsonResponse({"error": "unit_ids must be a non-empty list"}, status=400)

    sb = _sb()

    rr_result = sb.table("incidents_resourcerequest").select("*").eq("id", request_id).execute()
    if not rr_result.data:
        return JsonResponse({"error": "Request not found"}, status=404)
    rr = rr_result.data[0]

    units_result = sb.table("incidents_unit").select("*").in_("id", unit_ids).execute()
    units = units_result.data or []

    if len(units) != len(unit_ids):
        return JsonResponse({"error": "One or more unit_ids invalid"}, status=400)

    for u in units:
        if u["unit_type"] != rr["unit_type"]:
            return JsonResponse({"error": f"Unit {u['id']} type mismatch"}, status=400)
        if u["status"] != "AVAILABLE":
            return JsonResponse({"error": f"Unit {u['id']} not available"}, status=400)

    for u in units:
        sb.table("incidents_unit").update({"status": "ENROUTE"}).eq("id", u["id"]).execute()
        sb.table("incidents_logentry").insert({
            "unit_id": u["id"],
            "from_status": u["status"],
            "to_status": "ENROUTE",
        }).execute()

    sb.table("incidents_requestassignment").delete().eq("request_id", request_id).execute()
    sb.table("incidents_resourcerequest").delete().eq("id", request_id).execute()

    return JsonResponse({"ok": True, "deleted_request_id": request_id})


def logs_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    sb = _sb()
    q = (
        sb.table("incidents_logentry")
        .select("id,created_at,unit_id,from_status,to_status")
        .order("created_at", desc=True)
    )

    unit_id = request.GET.get("unit_id")
    if unit_id:
        q = q.eq("unit_id", unit_id)

    limit = request.GET.get("limit")
    if limit:
        try:
            q = q.limit(int(limit))
        except ValueError:
            pass

    result = q.execute()
    return JsonResponse(result.data or [], safe=False)


def _to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


@require_GET
def ambulance_low_check(request):
    from low_alert_prediction_model.ambulance_forecast import forecast_ambulance_low
    low, warning = forecast_ambulance_low()
    return JsonResponse({"low_ambulances": low, "warning": warning})


@csrf_exempt
def initial_prediction(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    incident = payload.get("incident", {})
    city = str(incident.get("city", "")).strip() or ""
    category = str(incident.get("incident_category", "")).strip() or ""
    subtype = str(incident.get("incident_subtype", "")).strip() or ""
    buildings = _to_int(incident.get("structures_threatened")) or _to_int(incident.get("structures_damaged"))
    population = _to_int(incident.get("population_affected_est"))

    from initial_prediction_model.initial_resource_model import estimate_resources_with_gpt

    try:
        prediction = estimate_resources_with_gpt(
            city=city,
            incident_category=category,
            incident_subtype=subtype,
            buildings_affected=buildings,
            population_affected=population,
        )
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=503)

    return JsonResponse({"prediction": prediction})
