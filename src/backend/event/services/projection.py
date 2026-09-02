from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from device.models import ParameterDefinition
from event.models import ParameterReading, PayloadField, ProjectionRule, RawEvent

from .exceptions import ProjectionError
from .parsing import ParsedPayload


@dataclass(frozen=True, slots=True)
class ProjectionResult:
    readings: tuple[ParameterReading, ...]
    device_timestamp: datetime | None


@dataclass(frozen=True, slots=True)
class _ProjectedValue:
    rule: ProjectionRule
    value_field: str
    value: int | datetime | str | bool


def project_readings(
    raw_event: RawEvent,
    parsed_payload: ParsedPayload,
) -> ProjectionResult:
    if raw_event.device_id is None or raw_event.payload_schema_id is None:
        raise ProjectionError("Raw event needs a device and payload schema.")
    payload_schema = raw_event.payload_schema

    projected_values: list[_ProjectedValue] = []
    device_timestamp: datetime | None = None
    rules = (
        ProjectionRule.objects.filter(payload_schema=payload_schema)
        .select_related("parameter", "source_field")
        .order_by("id")
    )

    for rule in rules:
        source_value = _source_value(rule, parsed_payload)
        value_field, value = _coerce_parameter_value(rule, source_value)
        projected_values.append(
            _ProjectedValue(rule=rule, value_field=value_field, value=value)
        )
        source_field = rule.source_field if rule.source_field_id is not None else None
        if (
            source_field is not None
            and source_field.role == PayloadField.Role.TIMESTAMP
        ):
            if not isinstance(value, datetime):
                raise ProjectionError("Timestamp field must project to datetime.")
            device_timestamp = value

    observed_at = device_timestamp or raw_event.received_at
    readings: list[ParameterReading] = []
    for projected in projected_values:
        reading = ParameterReading(
            raw_event=raw_event,
            device_id=raw_event.device_id,
            parameter=projected.rule.parameter,
            projection_rule=projected.rule,
            observed_at=observed_at,
            **{projected.value_field: projected.value},
        )
        reading.full_clean()
        readings.append(reading)

    return ProjectionResult(
        readings=tuple(readings),
        device_timestamp=device_timestamp,
    )


def _source_value(rule: ProjectionRule, parsed_payload: ParsedPayload) -> object:
    if rule.source_kind == ProjectionRule.SourceKind.CONSTANT:
        return rule.constant_value
    source_field = rule.source_field if rule.source_field_id is not None else None
    if rule.source_kind != ProjectionRule.SourceKind.FIELD or source_field is None:
        raise ProjectionError("Projection rule has no usable source.")

    try:
        return parsed_payload.values_by_field_id[source_field.pk]
    except KeyError as error:
        raise ProjectionError(
            f"Parsed value is missing for field {source_field.code!r}."
        ) from error


def _coerce_parameter_value(
    rule: ProjectionRule,
    source_value: object,
) -> tuple[str, int | datetime | str | bool]:
    value_type = rule.parameter.value_type
    config = rule.conversion_config
    if not isinstance(config, dict):
        raise ProjectionError("Conversion config must be an object.")

    if value_type == ParameterDefinition.ValueType.INTEGER:
        _reject_conversion_config(config)
        if type(source_value) is not int:
            raise ProjectionError("Integer parameter requires an integer source.")
        return "integer_value", source_value

    if value_type == ParameterDefinition.ValueType.STRING:
        _reject_conversion_config(config)
        if type(source_value) is not str:
            raise ProjectionError("String parameter requires a string source.")
        return "string_value", source_value

    if value_type == ParameterDefinition.ValueType.BOOLEAN:
        _reject_conversion_config(config)
        if type(source_value) is not bool:
            raise ProjectionError("Boolean parameter requires a boolean source.")
        return "boolean_value", source_value

    if value_type == ParameterDefinition.ValueType.DATETIME:
        return "datetime_value", _timestamp_to_datetime(source_value, config)

    raise ProjectionError(f"Unsupported parameter value type {value_type!r}.")


def _timestamp_to_datetime(source_value: object, config: dict[str, Any]) -> datetime:
    if type(source_value) is not int:
        raise ProjectionError("Datetime parameter requires an integer timestamp.")

    unknown_keys = set(config) - {"timestamp_unit"}
    if unknown_keys:
        raise ProjectionError("Datetime conversion config contains unknown keys.")
    unit = config.get("timestamp_unit", "seconds")
    if unit == "seconds":
        timestamp = source_value
    elif unit == "milliseconds":
        timestamp = source_value / 1000
    else:
        raise ProjectionError("Timestamp unit must be seconds or milliseconds.")

    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as error:
        raise ProjectionError(
            "Timestamp is outside supported datetime range."
        ) from error


def _reject_conversion_config(config: dict[str, Any]) -> None:
    if config:
        raise ProjectionError("Conversion config is unsupported for parameter type.")
