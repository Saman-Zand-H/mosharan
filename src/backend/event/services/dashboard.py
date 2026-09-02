from datetime import timedelta
from typing import cast

from django.utils import timezone

from account.models import User
from config.api_support import ApiProblem
from device.models import Device, DeviceQuerySet, ParameterDefinition
from event.models import (
    ParameterReading,
    ParameterReadingQuerySet,
    RawEvent,
    RawEventQuerySet,
    Visualization,
    VisualizationTab,
)

MAX_HISTORY_POINTS = 200
DEFAULT_RANGE_HOURS = 24
MAX_RANGE_HOURS = 24 * 30


def get_dashboard(
    user: User,
    *,
    device_id: int | None = None,
    hours: int = DEFAULT_RANGE_HOURS,
) -> dict[str, object]:
    """Return the complete dashboard projection for one visible device."""
    if hours < 1 or hours > MAX_RANGE_HOURS:
        raise ApiProblem(
            status=422,
            code="invalid_range",
            message=f"hours must be between 1 and {MAX_RANGE_HOURS}.",
        )

    visible_devices = (
        cast(DeviceQuerySet, Device.objects.all())
        .visible_to(user)
        .filter(gateway__is_active=True)
        .select_related("gateway", "device_type")
        .order_by("gateway__uid", "local_id", "pk")
    )
    if device_id is not None:
        device = visible_devices.filter(pk=device_id).first()
        if device is None:
            raise ApiProblem(
                status=404,
                code="device_not_found",
                message="The requested device is not visible to this user.",
            )
    else:
        device = (
            visible_devices.filter(is_active=True).first() or visible_devices.first()
        )

    devices_payload = [
        {
            "id": device.pk,
            "local_id": device.local_id,
            "is_active": device.is_active,
            "gateway_uid": device.gateway.uid,
            "gateway_title": device.gateway.title,
            "device_type_id": device.device_type_id,
            "device_type_code": device.device_type.code,
            "device_type_title": device.device_type.title,
        }
        for device in visible_devices
    ]
    if device is None:
        return {
            "devices": devices_payload,
            "selected_device_id": None,
            "range_hours": hours,
            "tabs": [],
            "binary_parameters": [],
            "recent_events": [],
        }

    cutoff = timezone.now() - timedelta(hours=hours)
    readings = (
        cast(ParameterReadingQuerySet, ParameterReading.objects.all())
        .visible_to(user)
        .filter(device=device, observed_at__gte=cutoff)
        .select_related("parameter")
    )
    tabs_payload = _tabs_payload(device, readings)
    binary_payload = _binary_payload(user, device, cutoff)
    recent_events = _recent_events(user, device, cutoff)
    return {
        "devices": devices_payload,
        "selected_device_id": device.pk,
        "range_hours": hours,
        "tabs": tabs_payload,
        "binary_parameters": binary_payload,
        "recent_events": recent_events,
    }


def _tabs_payload(device: Device, readings) -> list[dict[str, object]]:
    tabs = VisualizationTab.objects.filter(
        device_type_id=device.device_type_id,
        is_active=True,
    ).order_by("sort_order", "title", "pk")
    payload: list[dict[str, object]] = []
    for tab in tabs:
        visualization_payloads: list[dict[str, object]] = []
        configured_visualizations = (
            Visualization.objects.filter(tab=tab, is_active=True)
            .select_related("x_axis", "y_axis")
            .order_by("sort_order", "title", "pk")
        )
        for visualization in configured_visualizations:
            visualization_payloads.append(
                _visualization_payload(visualization, readings)
            )
        payload.append(
            {
                "id": tab.pk,
                "code": tab.code,
                "title": tab.title,
                "sort_order": tab.sort_order,
                "visualizations": visualization_payloads,
            }
        )
    return payload


def _visualization_payload(visualization: Visualization, readings) -> dict[str, object]:
    y_parameter = visualization.y_axis
    y_readings = list(
        readings.filter(parameter_id=y_parameter.pk).order_by(
            "observed_at", "date_created"
        )[:MAX_HISTORY_POINTS]
    )
    x_values: dict[str, float | str] = {}
    if visualization.x_axis_id is not None:
        for reading in readings.filter(parameter_id=visualization.x_axis_id):
            value = _reading_value(reading)
            if value is not None:
                x_values[reading.observed_at.isoformat()] = value

    points: list[dict[str, object]] = []
    for reading in y_readings:
        y_value = _reading_value(reading)
        if y_value is None:
            continue
        observed_key = reading.observed_at.isoformat()
        x_value: float | str = observed_key
        if visualization.x_axis_id is not None:
            x_value = x_values.get(observed_key, observed_key)
        points.append(
            {
                "x": str(x_value),
                "y": float(y_value),
                "observed_at": reading.observed_at,
            }
        )
    return {
        "id": visualization.pk,
        "title": visualization.title,
        "chart_type": visualization.chart_type,
        "x_axis": visualization.x_axis.code if visualization.x_axis else "observed_at",
        "y_axis": _parameter_payload(y_parameter),
        "points": points,
    }


def _binary_payload(user: User, device: Device, cutoff) -> list[dict[str, object]]:
    parameters = (
        ParameterDefinition.objects.filter(
            value_type=ParameterDefinition.ValueType.BOOLEAN,
            device_type_assignments__device_type_id=device.device_type_id,
        )
        .distinct()
        .order_by("code", "pk")
    )
    payload: list[dict[str, object]] = []
    for parameter in parameters:
        visible_parameter_readings = (
            cast(ParameterReadingQuerySet, ParameterReading.objects.all())
            .visible_to(user)
            .filter(
                device=device,
                parameter=parameter,
            )
        )
        latest = visible_parameter_readings.order_by(
            "-observed_at", "-date_created"
        ).first()
        parameter_readings = visible_parameter_readings.filter(
            observed_at__gte=cutoff
        ).order_by("observed_at", "date_created")
        history = list(parameter_readings[:MAX_HISTORY_POINTS])
        payload.append(
            {
                "parameter": _parameter_payload(parameter),
                "latest_value": latest.boolean_value if latest is not None else None,
                "latest_at": latest.observed_at if latest is not None else None,
                "history": [
                    {
                        "value": bool(reading.boolean_value),
                        "observed_at": reading.observed_at,
                    }
                    for reading in history
                ],
            }
        )
    return payload


def _recent_events(user: User, device: Device, cutoff) -> list[dict[str, object]]:
    events = (
        cast(RawEventQuerySet, RawEvent.objects.all())
        .visible_to(user)
        .filter(device=device, received_at__gte=cutoff)
        .select_related("gateway", "event_type")
        .order_by("-received_at", "-id")[:12]
    )
    return [
        {
            "id": event.pk,
            "device_local_id": event.received_local_id,
            "gateway_uid": event.gateway.uid,
            "event_type_title": event.event_type.title,
            "status": event.status,
            "received_at": event.received_at,
            "raw_payload": event.raw_payload,
            "parsing_error": event.parsing_error,
        }
        for event in events
    ]


def _parameter_payload(parameter: ParameterDefinition) -> dict[str, object]:
    return {
        "id": parameter.pk,
        "code": parameter.code,
        "title": parameter.title,
        "value_type": parameter.value_type,
        "unit": parameter.unit,
    }


def _reading_value(reading: ParameterReading) -> float | str | None:
    if reading.integer_value is not None:
        return float(reading.integer_value)
    if reading.datetime_value is not None:
        return reading.datetime_value.timestamp()
    return None
