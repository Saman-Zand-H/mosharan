import re

from django.db import models, transaction

from config.api_support import (
    ApiProblem,
    changed_values,
    delete_protected,
    get_object_or_problem,
    save_validated,
)
from device.models import DeviceType, ParameterDefinition
from event.models import (
    EventType,
    PayloadField,
    PayloadSchema,
    ProjectionRule,
    RawEvent,
    Visualization,
    VisualizationTab,
)
from event.schemas import (
    EventTypeCreateIn,
    EventTypeUpdateIn,
    PayloadFieldCreateIn,
    PayloadFieldUpdateIn,
    PayloadSchemaCreateIn,
    PayloadSchemaUpdateIn,
    ProjectionRuleCreateIn,
    ProjectionRuleUpdateIn,
    VisualizationCreateIn,
    VisualizationTabCreateIn,
    VisualizationTabUpdateIn,
    VisualizationUpdateIn,
)


def _validation_error(*, field: str, message: str) -> ApiProblem:
    return ApiProblem(
        status=422,
        code="validation_error",
        message="Submitted data is invalid.",
        fields={field: [message]},
    )


def _required_foreign_key(
    values: dict[str, object],
    field: str,
) -> int | None:
    if field not in values:
        return None
    value = values.pop(field)
    if not isinstance(value, int):
        raise _validation_error(
            field=field.removesuffix("_id") + "Id",
            message="This field may not be null.",
        )
    return value


def _schema_is_used(schema: PayloadSchema) -> bool:
    return RawEvent.objects.filter(payload_schema=schema).exists()


def _assert_schema_mutable(schema: PayloadSchema) -> None:
    if _schema_is_used(schema):
        raise ApiProblem(
            status=409,
            code="payload_schema_in_use",
            message="A payload schema cannot change after receiving an event.",
        )


def _coerce_constant(
    parameter: ParameterDefinition,
    value: object,
) -> object:
    if value is None:
        return None
    if parameter.value_type in {
        ParameterDefinition.ValueType.INTEGER,
        ParameterDefinition.ValueType.DATETIME,
    }:
        if isinstance(value, bool):
            raise _validation_error(
                field="constantValue",
                message="An integer constant is required.",
            )
        if isinstance(value, int):
            return value
        if isinstance(value, str) and re.fullmatch(r"[+-]?\d+", value):
            return int(value)
        raise _validation_error(
            field="constantValue",
            message="An integer constant is required.",
        )
    if parameter.value_type == ParameterDefinition.ValueType.STRING:
        if isinstance(value, str):
            return value
        raise _validation_error(
            field="constantValue",
            message="A string constant is required.",
        )
    if parameter.value_type == ParameterDefinition.ValueType.BOOLEAN:
        if isinstance(value, bool):
            return value
        raise _validation_error(
            field="constantValue",
            message="A boolean constant is required.",
        )
    raise _validation_error(
        field="constantValue",
        message="The parameter type is unsupported.",
    )


def _normalize_conversion_config(config: dict[str, str]) -> dict[str, str]:
    normalized = dict(config)
    camel_value = normalized.pop("timestampUnit", None)
    if camel_value is not None:
        if "timestamp_unit" in normalized:
            raise _validation_error(
                field="conversionConfig",
                message="Timestamp unit was supplied more than once.",
            )
        normalized["timestamp_unit"] = camel_value
    return normalized


@transaction.atomic
def create_event_type(payload: EventTypeCreateIn) -> EventType:
    return save_validated(EventType(code=payload.code, title=payload.title))


@transaction.atomic
def update_event_type(*, pk: int, payload: EventTypeUpdateIn) -> EventType:
    event_type = get_object_or_problem(
        EventType.objects.select_for_update(),
        pk=pk,
    )
    if RawEvent.objects.filter(event_type=event_type).exists():
        raise ApiProblem(
            status=409,
            code="event_type_in_use",
            message="An event type used by received events cannot change.",
        )
    values = changed_values(payload)
    for field, value in values.items():
        setattr(event_type, field, value)
    return save_validated(event_type, update_fields=(*values,))


@transaction.atomic
def delete_event_type(*, pk: int) -> None:
    event_type = get_object_or_problem(
        EventType.objects.select_for_update(),
        pk=pk,
    )
    delete_protected(event_type)


@transaction.atomic
def create_payload_schema(payload: PayloadSchemaCreateIn) -> PayloadSchema:
    event_type = get_object_or_problem(
        EventType.objects.all(),
        pk=payload.event_type_id,
    )
    device_type = get_object_or_problem(
        DeviceType.objects.all(),
        pk=payload.device_type_id,
    )
    return save_validated(
        PayloadSchema(
            event_type=event_type,
            device_type=device_type,
            version=payload.version,
            expected_length=payload.expected_length,
        )
    )


@transaction.atomic
def update_payload_schema(
    *,
    pk: int,
    payload: PayloadSchemaUpdateIn,
) -> PayloadSchema:
    schema = get_object_or_problem(
        PayloadSchema.objects.select_for_update().select_related("device_type"),
        pk=pk,
    )
    _assert_schema_mutable(schema)
    values = changed_values(payload)
    event_type_id = _required_foreign_key(values, "event_type_id")
    if event_type_id is not None:
        values["event_type"] = get_object_or_problem(
            EventType.objects.all(),
            pk=event_type_id,
        )
    device_type_id = _required_foreign_key(values, "device_type_id")
    if device_type_id is not None:
        if (
            device_type_id != schema.device_type.pk
            and ProjectionRule.objects.filter(payload_schema=schema).exists()
        ):
            raise ApiProblem(
                status=409,
                code="payload_schema_configuration_in_use",
                message=(
                    "A schema device type cannot change while projection rules exist."
                ),
            )
        values["device_type"] = get_object_or_problem(
            DeviceType.objects.all(),
            pk=device_type_id,
        )
    for field, value in values.items():
        setattr(schema, field, value)
    return save_validated(schema, update_fields=(*values,))


@transaction.atomic
def delete_payload_schema(*, pk: int) -> None:
    schema = get_object_or_problem(
        PayloadSchema.objects.select_for_update(),
        pk=pk,
    )
    _assert_schema_mutable(schema)
    for rule in ProjectionRule.objects.filter(payload_schema=schema).order_by("pk"):
        delete_protected(rule)
    delete_protected(schema)


@transaction.atomic
def create_payload_field(payload: PayloadFieldCreateIn) -> PayloadField:
    schema = get_object_or_problem(
        PayloadSchema.objects.select_for_update(),
        pk=payload.payload_schema_id,
    )
    _assert_schema_mutable(schema)
    return save_validated(
        PayloadField(
            payload_schema=schema,
            code=payload.code,
            name=payload.name,
            start_byte=payload.start_byte,
            end_byte=payload.end_byte,
            wire_codec=payload.wire_codec,
            role=payload.role,
        )
    )


@transaction.atomic
def update_payload_field(
    *,
    pk: int,
    payload: PayloadFieldUpdateIn,
) -> PayloadField:
    field = get_object_or_problem(
        PayloadField.objects.select_for_update().select_related("payload_schema"),
        pk=pk,
    )
    _assert_schema_mutable(field.payload_schema)
    values = changed_values(payload)
    structural_change = (
        (
            "payload_schema_id" in values
            and values["payload_schema_id"] != field.payload_schema.pk
        )
        or ("wire_codec" in values and values["wire_codec"] != field.wire_codec)
        or ("role" in values and values["role"] != field.role)
    )
    if structural_change and ProjectionRule.objects.filter(source_field=field).exists():
        raise ApiProblem(
            status=409,
            code="payload_field_configuration_in_use",
            message=("A projected field's schema, codec, and role cannot change."),
        )
    schema_id = _required_foreign_key(values, "payload_schema_id")
    if schema_id is not None:
        target_schema = get_object_or_problem(
            PayloadSchema.objects.select_for_update(),
            pk=schema_id,
        )
        _assert_schema_mutable(target_schema)
        values["payload_schema"] = target_schema
    for name, value in values.items():
        setattr(field, name, value)
    return save_validated(field, update_fields=(*values,))


@transaction.atomic
def delete_payload_field(*, pk: int) -> None:
    field = get_object_or_problem(
        PayloadField.objects.select_for_update().select_related("payload_schema"),
        pk=pk,
    )
    _assert_schema_mutable(field.payload_schema)
    delete_protected(field)


def _projection_relations(
    *,
    schema_id: int,
    parameter_id: int,
    source_field_id: int | None,
) -> tuple[PayloadSchema, ParameterDefinition, PayloadField | None]:
    schema = get_object_or_problem(
        PayloadSchema.objects.select_for_update(),
        pk=schema_id,
    )
    parameter = get_object_or_problem(
        ParameterDefinition.objects.all(),
        pk=parameter_id,
    )
    source_field = None
    if source_field_id is not None:
        source_field = get_object_or_problem(
            PayloadField.objects.all(),
            pk=source_field_id,
        )
    return schema, parameter, source_field


@transaction.atomic
def create_projection_rule(payload: ProjectionRuleCreateIn) -> ProjectionRule:
    schema, parameter, source_field = _projection_relations(
        schema_id=payload.payload_schema_id,
        parameter_id=payload.parameter_id,
        source_field_id=payload.source_field_id,
    )
    _assert_schema_mutable(schema)
    constant_value = _coerce_constant(parameter, payload.constant_value)
    return save_validated(
        ProjectionRule(
            payload_schema=schema,
            parameter=parameter,
            source_kind=payload.source_kind,
            source_field=source_field,
            constant_value=constant_value,
            conversion_config=_normalize_conversion_config(payload.conversion_config),
        )
    )


@transaction.atomic
def update_projection_rule(
    *,
    pk: int,
    payload: ProjectionRuleUpdateIn,
) -> ProjectionRule:
    rule = get_object_or_problem(
        ProjectionRule.objects.select_for_update().select_related(
            "payload_schema", "parameter", "source_field"
        ),
        pk=pk,
    )
    _assert_schema_mutable(rule.payload_schema)
    values = changed_values(payload)
    schema_id = _required_foreign_key(values, "payload_schema_id")
    if schema_id is not None:
        schema = get_object_or_problem(
            PayloadSchema.objects.select_for_update(),
            pk=schema_id,
        )
        _assert_schema_mutable(schema)
        values["payload_schema"] = schema
    parameter_id = _required_foreign_key(values, "parameter_id")
    if parameter_id is not None:
        values["parameter"] = get_object_or_problem(
            ParameterDefinition.objects.all(),
            pk=parameter_id,
        )
    if "source_field_id" in values:
        source_field_id = values.pop("source_field_id")
        source_field = None
        if isinstance(source_field_id, int):
            source_field = get_object_or_problem(
                PayloadField.objects.all(),
                pk=source_field_id,
            )
        values["source_field"] = source_field
    for name, value in values.items():
        setattr(rule, name, value)
    if "constant_value" in values:
        rule.constant_value = _coerce_constant(rule.parameter, rule.constant_value)
    if "conversion_config" in values:
        rule.conversion_config = _normalize_conversion_config(rule.conversion_config)
    return save_validated(rule, update_fields=(*values,))


@transaction.atomic
def delete_projection_rule(*, pk: int) -> None:
    rule = get_object_or_problem(
        ProjectionRule.objects.select_for_update().select_related("payload_schema"),
        pk=pk,
    )
    _assert_schema_mutable(rule.payload_schema)
    delete_protected(rule)


def _optional_foreign_key(
    values: dict[str, object],
    field: str,
    model: type[models.Model],
) -> models.Model | None:
    if field not in values:
        return None
    value = values.pop(field)
    if value is None:
        return None
    if not isinstance(value, int):
        raise _validation_error(
            field=field.removesuffix("_id") + "Id",
            message="This field must be an integer or null.",
        )
    return get_object_or_problem(model.objects.all(), pk=value)


@transaction.atomic
def create_visualization_tab(payload: VisualizationTabCreateIn) -> VisualizationTab:
    device_type = get_object_or_problem(
        DeviceType.objects.all(), pk=payload.device_type_id
    )
    return save_validated(
        VisualizationTab(
            device_type=device_type,
            code=payload.code,
            title=payload.title,
            sort_order=payload.sort_order,
            is_active=payload.is_active,
        )
    )


@transaction.atomic
def update_visualization_tab(
    *,
    pk: int,
    payload: VisualizationTabUpdateIn,
) -> VisualizationTab:
    tab = get_object_or_problem(VisualizationTab.objects.select_for_update(), pk=pk)
    values = changed_values(payload)
    device_type_id = _required_foreign_key(values, "device_type_id")
    if device_type_id is not None:
        if (
            Visualization.objects.filter(tab=tab).exists()
            and device_type_id != tab.device_type_id
        ):
            raise ApiProblem(
                status=409,
                code="visualization_tab_in_use",
                message="A tab with visualizations cannot change device type.",
            )
        values["device_type"] = get_object_or_problem(
            DeviceType.objects.all(), pk=device_type_id
        )
    for field, value in values.items():
        setattr(tab, field, value)
    return save_validated(tab, update_fields=(*values,))


@transaction.atomic
def delete_visualization_tab(*, pk: int) -> None:
    tab = get_object_or_problem(VisualizationTab.objects.select_for_update(), pk=pk)
    delete_protected(tab)


@transaction.atomic
def create_visualization(payload: VisualizationCreateIn) -> Visualization:
    tab = get_object_or_problem(VisualizationTab.objects.all(), pk=payload.tab_id)
    y_axis = get_object_or_problem(
        ParameterDefinition.objects.all(), pk=payload.y_axis_id
    )
    x_axis = None
    if payload.x_axis_id is not None:
        x_axis = get_object_or_problem(
            ParameterDefinition.objects.all(), pk=payload.x_axis_id
        )
    return save_validated(
        Visualization(
            tab=tab,
            title=payload.title,
            chart_type=payload.chart_type,
            x_axis=x_axis,
            y_axis=y_axis,
            sort_order=payload.sort_order,
            is_active=payload.is_active,
        )
    )


@transaction.atomic
def update_visualization(
    *,
    pk: int,
    payload: VisualizationUpdateIn,
) -> Visualization:
    visualization = get_object_or_problem(
        Visualization.objects.select_for_update(), pk=pk
    )
    values = changed_values(payload)
    tab_id = _required_foreign_key(values, "tab_id")
    if tab_id is not None:
        values["tab"] = get_object_or_problem(VisualizationTab.objects.all(), pk=tab_id)
    y_axis_id = _required_foreign_key(values, "y_axis_id")
    if y_axis_id is not None:
        values["y_axis"] = get_object_or_problem(
            ParameterDefinition.objects.all(), pk=y_axis_id
        )
    if "x_axis_id" in values:
        values["x_axis"] = _optional_foreign_key(
            values, "x_axis_id", ParameterDefinition
        )
    for field, value in values.items():
        setattr(visualization, field, value)
    return save_validated(visualization, update_fields=(*values,))


@transaction.atomic
def delete_visualization(*, pk: int) -> None:
    visualization = get_object_or_problem(
        Visualization.objects.select_for_update(), pk=pk
    )
    delete_protected(visualization)
