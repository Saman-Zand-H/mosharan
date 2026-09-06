from django.db import connection
from django.http import HttpRequest, JsonResponse


def health(request: HttpRequest) -> JsonResponse:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})
