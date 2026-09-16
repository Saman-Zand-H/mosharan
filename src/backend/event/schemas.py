from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from config.api_support import ApiSchema
from event.models import ProjectionRule

WireCodec = Literal["integer", "utf8", "boolean"]
FieldRole = Literal["metric", "timestamp", "sequence", "checksum"]
SourceKind = Literal["field", "constant"]
ConstantValue = str | bool | int | None


class EventTypeOut(ApiSchema):
    id: int
    code: str
    title: str
    date_created: datetime
    date_updated: datetime


class EventTypeCreateIn(ApiSchema):
    code: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)


class EventTypeUpdateIn(ApiSchema):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=255)


class PayloadSchemaOut(ApiSchema):
    id: int
    event_type_id: int
    device_type_id: int
    version: int
    encoding: Literal["utf-8"]
    expected_length: int | None
    date_created: datetime
    date_updated: datetime


class PayloadSchemaCreateIn(ApiSchema):
    event_type_id: int = Field(gt=0)
    device_type_id: int = Field(gt=0)
    version: int = Field(gt=0)
    expected_length: int | None = Field(default=None, gt=0)


class PayloadSchemaUpdateIn(ApiSchema):
    event_type_id: int | None = Field(default=None, gt=0)
    device_type_id: int | None = Field(default=None, gt=0)
    version: int | None = Field(default=None, gt=0)
    expected_length: int | None = Field(default=None, gt=0)


class PayloadFieldOut(ApiSchema):
    id: int
    payload_schema_id: int
    code: str
    name: str
    start_byte: int
    end_byte: int
    wire_codec: WireCodec
    role: FieldRole
    date_created: datetime
    date_updated: datetime


class PayloadFieldCreateIn(ApiSchema):
    payload_schema_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    start_byte: int = Field(ge=0)
    end_byte: int = Field(gt=0)
    wire_codec: WireCodec
    role: FieldRole = "metric"


class PayloadFieldUpdateIn(ApiSchema):
    payload_schema_id: int | None = Field(default=None, gt=0)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    start_byte: int | None = Field(default=None, ge=0)
    end_byte: int | None = Field(default=None, gt=0)
    wire_codec: WireCodec | None = None
    role: FieldRole | None = None


class ProjectionRuleOut(ApiSchema):
    id: int
    payload_schema_id: int
    parameter_id: int
    source_kind: SourceKind
    source_field_id: int | None
    constant_value: str | bool | None
    conversion_config: dict[str, str]
    date_created: datetime
    date_updated: datetime


def serialize_constant_value(rule: ProjectionRule) -> str | bool | None:
    value = rule.constant_value
    if value is None or isinstance(value, bool):
        return value
    if rule.parameter.value_type in {"integer", "datetime"}:
        return str(value)
    return value


def serialize_conversion_config(rule: ProjectionRule) -> dict[str, str]:
    config = rule.conversion_config
    if "timestamp_unit" in config:
        return {"timestampUnit": config["timestamp_unit"]}
    return config


def projection_rule_payload(rule: ProjectionRule) -> dict[str, object]:
    return {
        "id": rule.pk,
        "payloadSchemaId": rule.payload_schema_id,
        "parameterId": rule.parameter_id,
        "sourceKind": rule.source_kind,
        "sourceFieldId": rule.source_field_id,
        "constantValue": serialize_constant_value(rule),
        "conversionConfig": serialize_conversion_config(rule),
        "dateCreated": rule.date_created,
        "dateUpdated": rule.date_updated,
    }


class ProjectionRuleCreateIn(ApiSchema):
    payload_schema_id: int = Field(gt=0)
    parameter_id: int = Field(gt=0)
    source_kind: SourceKind
    source_field_id: int | None = Field(default=None, gt=0)
    constant_value: ConstantValue = None
    conversion_config: dict[str, str] = Field(default_factory=dict)


class ProjectionRuleUpdateIn(ApiSchema):
    payload_schema_id: int | None = Field(default=None, gt=0)
    parameter_id: int | None = Field(default=None, gt=0)
    source_kind: SourceKind | None = None
    source_field_id: int | None = Field(default=None, gt=0)
    constant_value: ConstantValue = None
    conversion_config: dict[str, str] | None = None


class CatalogEventTypeOut(ApiSchema):
    code: str
    title: str


class CatalogDeviceTypeOut(ApiSchema):
    code: str
    title: str


class CatalogParameterOut(ApiSchema):
    code: str
    title: str
    value_type: Literal["integer", "datetime", "string", "boolean"]
    unit: str | None = None


class CatalogFieldOut(ApiSchema):
    id: str
    code: str
    name: str
    start_byte: int
    end_byte: int
    wire_codec: WireCodec
    role: FieldRole


class CatalogProjectionRuleOut(ApiSchema):
    id: str
    parameter: CatalogParameterOut
    source_kind: SourceKind
    source_field_id: str | None
    constant_value: str | bool | None
    conversion_config: dict[str, str]


class CatalogPayloadSchemaOut(ApiSchema):
    id: str
    event_type: CatalogEventTypeOut
    device_type: CatalogDeviceTypeOut
    version: int
    encoding: Literal["utf-8"]
    expected_length: int | None
    fields: list[CatalogFieldOut]
    projection_rules: list[CatalogProjectionRuleOut]


class SampleEnvelopeOut(ApiSchema):
    gateway_uid: str
    device_local_id: str
    event_type_code: str
    schema_version: int
    message_id: str


class SamplePacketOut(ApiSchema):
    id: str
    title: str
    schema_id: str
    envelope: SampleEnvelopeOut
    payload: str
    description: str


class CatalogGatewayOut(ApiSchema):
    uid: str
    title: str
    is_active: bool


class CatalogDeviceOut(ApiSchema):
    id: int
    local_id: str
    is_active: bool
    device_type_code: str
    gateway: CatalogGatewayOut


class SimulatorCatalogOut(ApiSchema):
    source: Literal["database_api"]
    schemas: list[CatalogPayloadSchemaOut]
    devices: list[CatalogDeviceOut]
    samples: list[SamplePacketOut]


class WorkspaceEventOut(ApiSchema):
    id: UUID
    gateway_uid: str
    device_local_id: str
    event_type_code: str
    event_type_title: str
    schema_version: int
    message_id: str
    raw_payload: str
    status: Literal["received", "processed", "failed"]
    received_at: datetime
    device_timestamp: datetime | None
    parsing_error: str


class IngestPayloadIn(ApiSchema):
    """Hardware envelope; gateway identity comes from the bearer credential."""

    device_local_id: str = Field(min_length=1, max_length=64)
    event_type_code: str = Field(min_length=1, max_length=64)
    schema_version: int = Field(gt=0)
    message_id: str = Field(min_length=1, max_length=128)
    payload: str = Field(min_length=1, max_length=64 * 1024)


class IngestResultOut(ApiSchema):
    raw_event_id: UUID
    status: Literal["received", "processed", "failed"]
    created: bool
    reading_ids: list[int]


ChartType = Literal["line", "bar", "area"]


class VisualizationTabOut(ApiSchema):
    id: int
    device_type_id: int
    code: str
    title: str
    sort_order: int
    is_active: bool
    date_created: datetime
    date_updated: datetime


class VisualizationTabCreateIn(ApiSchema):
    device_type_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class VisualizationTabUpdateIn(ApiSchema):
    device_type_id: int | None = Field(default=None, gt=0)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class VisualizationOut(ApiSchema):
    id: int
    tab_id: int
    title: str
    chart_type: ChartType
    x_axis_id: int | None
    y_axis_id: int
    sort_order: int
    is_active: bool
    date_created: datetime
    date_updated: datetime


class VisualizationCreateIn(ApiSchema):
    tab_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    chart_type: ChartType = "line"
    x_axis_id: int | None = Field(default=None, gt=0)
    y_axis_id: int = Field(gt=0)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class VisualizationUpdateIn(ApiSchema):
    tab_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    chart_type: ChartType | None = None
    x_axis_id: int | None = Field(default=None, gt=0)
    y_axis_id: int | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class DashboardParameterOut(ApiSchema):
    id: int
    code: str
    title: str
    value_type: Literal["integer", "datetime", "string", "boolean"]
    unit: str | None


class DashboardDeviceOut(ApiSchema):
    id: int
    local_id: str
    is_active: bool
    gateway_uid: str
    gateway_title: str
    device_type_id: int
    device_type_code: str
    device_type_title: str


class DashboardPointOut(ApiSchema):
    x: str
    y: float
    observed_at: datetime


class DashboardVisualizationOut(ApiSchema):
    id: int
    title: str
    chart_type: ChartType
    x_axis: str
    y_axis: DashboardParameterOut
    points: list[DashboardPointOut]


class DashboardTabOut(ApiSchema):
    id: int
    code: str
    title: str
    sort_order: int
    visualizations: list[DashboardVisualizationOut]


class BinaryHistoryPointOut(ApiSchema):
    value: bool
    observed_at: datetime


class DashboardBinaryParameterOut(ApiSchema):
    parameter: DashboardParameterOut
    latest_value: bool | None
    latest_at: datetime | None
    history: list[BinaryHistoryPointOut]


class DashboardEventOut(ApiSchema):
    id: UUID
    device_local_id: str
    gateway_uid: str
    event_type_title: str
    status: Literal["received", "processed", "failed"]
    received_at: datetime
    raw_payload: str
    parsing_error: str


class DashboardOut(ApiSchema):
    devices: list[DashboardDeviceOut]
    selected_device_id: int | None
    range_hours: int
    tabs: list[DashboardTabOut]
    binary_parameters: list[DashboardBinaryParameterOut]
    recent_events: list[DashboardEventOut]
