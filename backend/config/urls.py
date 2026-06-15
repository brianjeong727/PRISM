from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, FileResponse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def api_root(request):
    return JsonResponse({"status": "ok", "message": "PRISM API running"})


def serve_spa(request, *args, **kwargs):
    """Serve the React SPA index.html for all non-API routes (client-side routing)."""
    index_path = BASE_DIR / 'static_frontend' / 'index.html'
    return FileResponse(open(str(index_path), 'rb'), content_type='text/html')


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("incidents.urls")),
    # SPA catch-all: any path not starting with api/ or admin/ serves index.html
    re_path(r'^(?!api/)(?!admin/)(?!static/).*$', serve_spa),
]
