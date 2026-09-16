from typing import Annotated, cast

from django.db.models import Prefetch
from django.http import HttpRequest
from ninja import Query, Router
from ninja.pagination import LimitOffsetPagination, paginate
from ninja.responses import Status

from account.models import User
from config.api_support import ApiProblem, get_object_or_problem
from config.security import (
    active_session_auth,
    active_superuser_auth,
    gateway_token_auth,
)
from device.models import Device, DeviceQuerySet, Gateway
from event.models import (
    EventType,
    PayloadField,
    PayloadSchema,
    ProjectionRule,
    RawEvent,
    RawEventQuerySet,
    Visualization,
    VisualizationTab,
)
from event.schemas import (
    DashboardOut,
    EventTypeCreateIn,
    EventTypeOut,
    EventTypeUpdateIn,
    IngestPayloadIn,
    IngestResultOut,
    PayloadFieldCreateIn,
    PayloadFieldOut,
    PayloadFieldUpdateIn,
    PayloadSchemaCreateIn,
    PayloadSchemaOut,
    PayloadSchemaUpdateIn,
    ProjectionRuleCreateIn,
    ProjectionRuleOut,
    ProjectionRuleUpdateIn,
    SimulatorCatalogOut,
    VisualizationCreateIn,
    VisualizationOut,
    VisualizationTabCreateIn,
    VisualizationTabOut,
    VisualizationTabUpdateIn,
    VisualizationUpdateIn,
    WorkspaceEventOut,
    projection_rule_payload,
    serialize_constant_value,
    serialize_conversion_config,
)
from event.services import (
    IdempotencyConflictError,
    IngestionError,
    IngestionRequest,
    ingest_event,
)
from event.services.configuration import (
    create_event_type,
    create_payload_field,
    create_payload_schema,
    create_projection_rule,
    create_visualization,
    create_visualization_tab,
    delete_event_type,
    delete_payload_field,
    delete_payload_schema,
    delete_projection_rule,
    delete_visualization,
    delete_visualization_tab,
    update_event_type,
    update_payload_field,
    update_payload_schema,
    update_projection_rule,
    update_visualization,
    update_visualization_tab,
)
from event.services.dashboard import get_dashboard

management_router = Router(
    auth=active_superuser_auth,
    tags=["Platform management"],
    by_alias=True,
)
simulator_router = Router(
    auth=active_superuser_auth,
    tags=["Simulator"],
    by_alias=True,
)
workspace_router = Router(
    auth=active_session_auth,
    tags=["Telemetry workspace"],
    by_alias=True,
)
ingestion_router = Router(
    auth=gateway_token_auth,
    tags=["Hardware ingestion"],
    by_alias=True,
)


def _ingestion_error(error: IngestionError) -> ApiProblem:
    status = 409 if isinstance(error, IdempotencyConflictError) else 422
    return ApiProblem(
        status=status,
        code=error.code,
        message=str(error),
    )


def _ingestion_payload(result) -> dict[str, object]:
    return {
        "raw_event_id": result.raw_event_id,
        "status": result.status,
        "created": result.created,
        "reading_ids": list(result.reading_ids),
    }


@ingestion_router.post(
    "/ingest",
    response={200: IngestResultOut, 201: IngestResultOut},
)
def ingest(request: HttpRequest, payload: IngestPayloadIn):
    """Accept one schema-driven hardware payload.

    Gateway identity is taken from the authenticated gateway token and header,
    never from the JSON body. The service resolves the matching
    ``PayloadSchema`` and performs raw-first parsing/projection atomically.
    """
    gateway = cast(Gateway, getattr(request, "auth"))
    try:
        result = ingest_event(
            IngestionRequest(
                gateway_uid=gateway.uid,
                device_local_id=payload.device_local_id,
                event_type_code=payload.event_type_code,
                schema_version=payload.schema_version,
                message_id=payload.message_id,
                payload=payload.payload,
            )
        )
    except IngestionError as error:
        raise _ingestion_error(error) from error
    response_payload = _ingestion_payload(result)
    return Status(201 if result.created else 200, response_payload)


@workspace_router.get("/dashboard", response=DashboardOut)
def dashboard(
    request: HttpRequest,
    device_id: Annotated[int | None, Query(alias="deviceId")] = None,
    hours: Annotated[int, Query(ge=1, le=720)] = 24,
):
    user = cast(User, getattr(request, "auth"))
    return get_dashboard(user, device_id=device_id, hours=hours)


@workspace_router.get("/events/recent", response=list[WorkspaceEventOut])
def recent_events(request: HttpRequest):
    user = cast(User, getattr(request, "auth"))
    events = (
        cast(RawEventQuerySet, RawEvent.objects.all())
        .visible_to(user)
        .select_related("gateway", "device", "event_type")
        .order_by("-received_at", "-id")[:100]
    )
    return [
        {
            "id": event.pk,
            "gateway_uid": event.gateway.uid,
            "device_local_id": event.received_local_id,
            "event_type_code": event.event_type.code,
            "event_type_title": event.event_type.title,
            "schema_version": event.received_schema_version,
            "message_id": event.message_id,
            "raw_payload": event.raw_payload,
            "status": event.status,
            "received_at": event.received_at,
            "device_timestamp": event.device_timestamp,
            "parsing_error": event.parsing_error,
        }
        for event in events
    ]


@management_router.get("/event-types", response=list[EventTypeOut])
@paginate(LimitOffsetPagination)
def list_event_types(request: HttpRequest):
    return EventType.objects.order_by("code", "pk")


@management_router.get("/event-types/{pk}", response=EventTypeOut)
def get_event_type(request: HttpRequest, pk: int):
    return get_object_or_problem(EventType.objects.all(), pk=pk)


@management_router.post("/event-types", response={201: EventTypeOut})
def post_event_type(request: HttpRequest, payload: EventTypeCreateIn):
    return Status(201, create_event_type(payload))


@management_router.patch("/event-types/{pk}", response=EventTypeOut)
def patch_event_type(request: HttpRequest, pk: int, payload: EventTypeUpdateIn):
    return update_event_type(pk=pk, payload=payload)


@management_router.delete("/event-types/{pk}", response={204: None})
def remove_event_type(request: HttpRequest, pk: int):
    delete_event_type(pk=pk)
    return Status(204, None)


@management_router.get("/payload-schemas", response=list[PayloadSchemaOut])
@paginate(LimitOffsetPagination)
def list_payload_schemas(request: HttpRequest):
    return PayloadSchema.objects.select_related("event_type", "device_type").order_by(
        "event_type__code", "device_type__code", "version", "pk"
    )


@management_router.get("/payload-schemas/{pk}", response=PayloadSchemaOut)
def get_payload_schema(request: HttpRequest, pk: int):
    return get_object_or_problem(PayloadSchema.objects.all(), pk=pk)


@management_router.post("/payload-schemas", response={201: PayloadSchemaOut})
def post_payload_schema(request: HttpRequest, payload: PayloadSchemaCreateIn):
    return Status(201, create_payload_schema(payload))


@management_router.patch("/payload-schemas/{pk}", response=PayloadSchemaOut)
def patch_payload_schema(
    request: HttpRequest,
    pk: int,
    payload: PayloadSchemaUpdateIn,
):
    return update_payload_schema(pk=pk, payload=payload)


@management_router.delete("/payload-schemas/{pk}", response={204: None})
def remove_payload_schema(request: HttpRequest, pk: int):
    delete_payload_schema(pk=pk)
    return Status(204, None)


@management_router.get("/payload-fields", response=list[PayloadFieldOut])
@paginate(LimitOffsetPagination)
def list_payload_fields(request: HttpRequest):
    return PayloadField.objects.select_related("payload_schema").order_by(
        "payload_schema_id", "start_byte", "pk"
    )


@management_router.get("/payload-fields/{pk}", response=PayloadFieldOut)
def get_payload_field(request: HttpRequest, pk: int):
    return get_object_or_problem(PayloadField.objects.all(), pk=pk)


@management_router.post("/payload-fields", response={201: PayloadFieldOut})
def post_payload_field(request: HttpRequest, payload: PayloadFieldCreateIn):
    return Status(201, create_payload_field(payload))


@management_router.patch("/payload-fields/{pk}", response=PayloadFieldOut)
def patch_payload_field(
    request: HttpRequest,
    pk: int,
    payload: PayloadFieldUpdateIn,
):
    return update_payload_field(pk=pk, payload=payload)


@management_router.delete("/payload-fields/{pk}", response={204: None})
def remove_payload_field(request: HttpRequest, pk: int):
    delete_payload_field(pk=pk)
    return Status(204, None)


@management_router.get("/projection-rules", response=list[ProjectionRuleOut])
@paginate(LimitOffsetPagination)
def list_projection_rules(request: HttpRequest):
    rules = ProjectionRule.objects.select_related(
        "payload_schema", "parameter", "source_field"
    ).order_by("payload_schema_id", "parameter__code", "pk")
    return [projection_rule_payload(rule) for rule in rules]


@management_router.get("/projection-rules/{pk}", response=ProjectionRuleOut)
def get_projection_rule(request: HttpRequest, pk: int):
    return projection_rule_payload(
        get_object_or_problem(
            ProjectionRule.objects.select_related("parameter"),
            pk=pk,
        )
    )


@management_router.post("/projection-rules", response={201: ProjectionRuleOut})
def post_projection_rule(request: HttpRequest, payload: ProjectionRuleCreateIn):
    return Status(201, projection_rule_payload(create_projection_rule(payload)))


@management_router.patch("/projection-rules/{pk}", response=ProjectionRuleOut)
def patch_projection_rule(
    request: HttpRequest,
    pk: int,
    payload: ProjectionRuleUpdateIn,
):
    return projection_rule_payload(update_projection_rule(pk=pk, payload=payload))


@management_router.delete("/projection-rules/{pk}", response={204: None})
def remove_projection_rule(request: HttpRequest, pk: int):
    delete_projection_rule(pk=pk)
    return Status(204, None)


@management_router.get("/visualization-tabs", response=list[VisualizationTabOut])
@paginate(LimitOffsetPagination)
def list_visualization_tabs(request: HttpRequest):
    return VisualizationTab.objects.select_related("device_type").order_by(
        "sort_order", "title", "pk"
    )


@management_router.get("/visualization-tabs/{pk}", response=VisualizationTabOut)
def get_visualization_tab(request: HttpRequest, pk: int):
    return get_object_or_problem(VisualizationTab.objects.all(), pk=pk)


@management_router.post("/visualization-tabs", response={201: VisualizationTabOut})
def post_visualization_tab(request: HttpRequest, payload: VisualizationTabCreateIn):
    return Status(201, create_visualization_tab(payload))


@management_router.patch("/visualization-tabs/{pk}", response=VisualizationTabOut)
def patch_visualization_tab(
    request: HttpRequest,
    pk: int,
    payload: VisualizationTabUpdateIn,
):
    return update_visualization_tab(pk=pk, payload=payload)


@management_router.delete("/visualization-tabs/{pk}", response={204: None})
def remove_visualization_tab(request: HttpRequest, pk: int):
    delete_visualization_tab(pk=pk)
    return Status(204, None)


@management_router.get("/visualizations", response=list[VisualizationOut])
@paginate(LimitOffsetPagination)
def list_visualizations(request: HttpRequest):
    return Visualization.objects.select_related("tab", "x_axis", "y_axis").order_by(
        "tab_id", "sort_order", "title", "pk"
    )


@management_router.get("/visualizations/{pk}", response=VisualizationOut)
def get_visualization(request: HttpRequest, pk: int):
    return get_object_or_problem(Visualization.objects.all(), pk=pk)


@management_router.post("/visualizations", response={201: VisualizationOut})
def post_visualization(request: HttpRequest, payload: VisualizationCreateIn):
    return Status(201, create_visualization(payload))


@management_router.patch("/visualizations/{pk}", response=VisualizationOut)
def patch_visualization(
    request: HttpRequest,
    pk: int,
    payload: VisualizationUpdateIn,
):
    return update_visualization(pk=pk, payload=payload)


@management_router.delete("/visualizations/{pk}", response={204: None})
def remove_visualization(request: HttpRequest, pk: int):
    delete_visualization(pk=pk)
    return Status(204, None)


@workspace_router.get("/workspace/catalog", response=SimulatorCatalogOut)
def workspace_catalog(request: HttpRequest):
    """Return the read-only catalog needed by regular workspace pages."""
    user = cast(User, getattr(request, "auth"))
    return _catalog_payload(user)


@simulator_router.get("/catalog", response=SimulatorCatalogOut)
def simulator_catalog(request: HttpRequest):
    """Return the packet simulator catalog for platform administrators."""
    user = cast(User, getattr(request, "auth"))
    return _catalog_payload(user)


def _catalog_payload(user: User) -> dict[str, object]:
    devices = (
        cast(DeviceQuerySet, Device.objects.all())
        .visible_to(user)
        .select_related("gateway", "device_type")
    )
    schemas = PayloadSchema.objects.select_related("event_type", "device_type")
    if not user.is_superuser:
        device_type_ids = devices.values_list("device_type_id", flat=True)
        schemas = schemas.filter(device_type_id__in=device_type_ids)
    fields = PayloadField.objects.order_by("start_byte", "pk")
    rules = ProjectionRule.objects.select_related("parameter", "source_field").order_by(
        "pk"
    )
    schemas = schemas.prefetch_related(
        Prefetch("fields", queryset=fields),
        Prefetch("projection_rules", queryset=rules),
    ).order_by("event_type__code", "device_type__code", "version", "pk")
    schema_payloads = []
    for schema in schemas:
        schema_fields = [
            {
                "id": str(field.pk),
                "code": field.code,
                "name": field.name,
                "startByte": field.start_byte,
                "endByte": field.end_byte,
                "wireCodec": field.wire_codec,
                "role": field.role,
            }
            for field in getattr(schema, "fields").all()
        ]
        schema_rules = []
        for rule in getattr(schema, "projection_rules").all():
            schema_rules.append(
                {
                    "id": str(rule.pk),
                    "parameter": {
                        "code": rule.parameter.code,
                        "title": rule.parameter.title,
                        "valueType": rule.parameter.value_type,
                        "unit": rule.parameter.unit,
                    },
                    "sourceKind": rule.source_kind,
                    "sourceFieldId": (
                        str(rule.source_field_id)
                        if rule.source_field_id is not None
                        else None
                    ),
                    "constantValue": serialize_constant_value(rule),
                    "conversionConfig": serialize_conversion_config(rule),
                }
            )
        schema_payloads.append(
            {
                "id": str(schema.pk),
                "eventType": {
                    "code": schema.event_type.code,
                    "title": schema.event_type.title,
                },
                "deviceType": {
                    "code": schema.device_type.code,
                    "title": schema.device_type.title,
                },
                "version": schema.version,
                "encoding": schema.encoding,
                "expectedLength": schema.expected_length,
                "fields": schema_fields,
                "projectionRules": schema_rules,
            }
        )
    device_payloads = [
        {
            "id": device.pk,
            "localId": device.local_id,
            "isActive": device.is_active,
            "deviceTypeCode": device.device_type.code,
            "gateway": {
                "uid": device.gateway.uid,
                "title": device.gateway.title,
                "isActive": device.gateway.is_active,
            },
        }
        for device in devices.order_by("gateway__uid", "local_id", "pk")
    ]
    return {
        "source": "database_api",
        "schemas": schema_payloads,
        "devices": device_payloads,
        "samples": [],
    }
