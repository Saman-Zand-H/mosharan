from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI, Router
from ninja.errors import AuthenticationError, HttpError
from ninja.errors import ValidationError as NinjaValidationError

from account.api import auth_router
from account.api import management_router as account_management_router
from account.models import Company, User
from account.schemas import CompanyOut, UserOut
from device.api import management_router as device_management_router
from device.models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from device.schemas import (
    DeviceOut,
    DeviceTypeOut,
    DeviceTypeParameterOut,
    GatewayOut,
    ParameterOut,
)
from event.api import ingestion_router, simulator_router, workspace_router
from event.api import management_router as event_management_router
from event.models import (
    EventType,
    PayloadField,
    PayloadSchema,
    ProjectionRule,
    Visualization,
    VisualizationTab,
)
from event.schemas import (
    EventTypeOut,
    PayloadFieldOut,
    PayloadSchemaOut,
    ProjectionRuleOut,
    VisualizationOut,
    VisualizationTabOut,
    projection_rule_payload,
)

from .api_support import ApiProblem, ApiSchema
from .security import active_superuser_auth

api = NinjaAPI(
    title="Device Telemetry API",
    version="1.0.0",
    urls_namespace="telemetry-api-v1",
    default_router=Router(by_alias=True),
)


class ManagementSnapshotOut(ApiSchema):
    users: list[UserOut]
    companies: list[CompanyOut]
    gateways: list[GatewayOut]
    devices: list[DeviceOut]
    device_types: list[DeviceTypeOut]
    parameters: list[ParameterOut]
    device_type_parameters: list[DeviceTypeParameterOut]
    event_types: list[EventTypeOut]
    payload_schemas: list[PayloadSchemaOut]
    payload_fields: list[PayloadFieldOut]
    projection_rules: list[ProjectionRuleOut]
    visualization_tabs: list[VisualizationTabOut]
    visualizations: list[VisualizationOut]


@api.exception_handler(ApiProblem)
def api_problem_handler(request: HttpRequest, error: ApiProblem) -> HttpResponse:
    payload: dict[str, object] = {
        "code": error.code,
        "message": error.message,
    }
    if error.fields is not None:
        payload["fields"] = error.fields
    return api.create_response(request, payload, status=error.status)


@api.exception_handler(AuthenticationError)
def authentication_error_handler(
    request: HttpRequest,
    error: AuthenticationError,
) -> HttpResponse:
    return api.create_response(
        request,
        {"code": "unauthorized", "message": "Authentication is required."},
        status=error.status_code,
    )


@api.exception_handler(HttpError)
def http_error_handler(request: HttpRequest, error: HttpError) -> HttpResponse:
    code = "csrf_failed" if error.status_code == 403 else "request_error"
    return api.create_response(
        request,
        {"code": code, "message": str(error)},
        status=error.status_code,
    )


@api.exception_handler(NinjaValidationError)
def request_validation_error_handler(
    request: HttpRequest,
    error: NinjaValidationError,
) -> HttpResponse:
    fields: dict[str, list[str]] = {}
    for issue in error.errors:
        location = issue.get("loc", ())
        field = str(location[-1]) if location else "__all__"
        fields.setdefault(field, []).append(str(issue.get("msg", "Invalid value.")))
    return api.create_response(
        request,
        {
            "code": "validation_error",
            "message": "Submitted data is invalid.",
            "fields": fields,
        },
        status=422,
    )


@api.get(
    "/management/snapshot",
    auth=active_superuser_auth,
    response=ManagementSnapshotOut,
    tags=["Platform management"],
)
def management_snapshot(request: HttpRequest):
    return {
        "users": User.objects.order_by("username", "pk"),
        "companies": Company.objects.select_related("user").order_by("name", "pk"),
        "gateways": Gateway.objects.select_related("company").order_by("uid", "pk"),
        "devices": Device.objects.select_related("gateway", "device_type").order_by(
            "gateway__uid", "local_id", "pk"
        ),
        "device_types": DeviceType.objects.order_by("code", "pk"),
        "parameters": ParameterDefinition.objects.order_by("code", "pk"),
        "device_type_parameters": DeviceTypeParameter.objects.select_related(
            "device_type", "parameter"
        ).order_by("device_type__code", "parameter__code", "pk"),
        "event_types": EventType.objects.order_by("code", "pk"),
        "payload_schemas": PayloadSchema.objects.select_related(
            "event_type", "device_type"
        ).order_by("event_type__code", "device_type__code", "version", "pk"),
        "payload_fields": PayloadField.objects.select_related(
            "payload_schema"
        ).order_by("payload_schema_id", "start_byte", "pk"),
        "projectionRules": [
            projection_rule_payload(rule)
            for rule in ProjectionRule.objects.select_related(
                "payload_schema", "parameter", "source_field"
            ).order_by("payload_schema_id", "parameter__code", "pk")
        ],
        "visualization_tabs": VisualizationTab.objects.select_related(
            "device_type"
        ).order_by("sort_order", "title", "pk"),
        "visualizations": Visualization.objects.select_related(
            "tab", "x_axis", "y_axis"
        ).order_by("tab_id", "sort_order", "title", "pk"),
    }


api.add_router("/auth", auth_router)
api.add_router("/management", account_management_router)
api.add_router("/management", device_management_router)
api.add_router("/management", event_management_router)
api.add_router("/simulator", simulator_router)
api.add_router("", ingestion_router)
api.add_router("", workspace_router)
