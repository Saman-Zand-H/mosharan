import logging
from typing import NoReturn
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from device.models import Device, Gateway
from event.models import EventType, ParameterReading, PayloadSchema, RawEvent

from .exceptions import (
    IdempotencyConflictError,
    InactiveDeviceError,
    InactiveGatewayError,
    IngestionError,
    IngestionProcessingError,
    InvalidIngestionRequestError,
    UnknownDeviceError,
    UnknownEventTypeError,
    UnknownGatewayError,
    UnknownPayloadSchemaError,
)
from .parsing import parse_payload
from .projection import project_readings
from .types import IngestionRequest, IngestionResult

logger = logging.getLogger(__name__)

MAX_PAYLOAD_BYTES = 64 * 1024
MAX_FAILURE_DETAIL_LENGTH = 2000


def ingest_event(request: IngestionRequest) -> IngestionResult:
    """Persist, parse, and project one authenticated gateway event.

    Gateway authentication belongs to the caller. This function validates the
    registry identity, preserves the raw event before parsing, and processes
    idempotent retries under a row lock.
    """

    _validate_request(request)
    gateway = _get_gateway(request.gateway_uid)
    event_type = _get_event_type(request.event_type_code)
    device = (
        Device.objects.select_related("device_type")
        .filter(gateway=gateway, local_id=request.device_local_id)
        .first()
    )
    payload_schema = _get_payload_schema(
        event_type=event_type,
        device=device,
        version=request.schema_version,
    )

    raw_event, created = RawEvent.objects.get_or_create(
        gateway=gateway,
        message_id=request.message_id,
        defaults={
            "device": device,
            "received_gateway_uid": request.gateway_uid,
            "received_local_id": request.device_local_id,
            "received_schema_version": request.schema_version,
            "event_type": event_type,
            "payload_schema": payload_schema,
            "raw_payload": request.payload,
        },
    )
    _assert_same_envelope(
        raw_event=raw_event,
        request=request,
        event_type=event_type,
        device=device,
        payload_schema=payload_schema,
    )

    return _process_raw_event(
        raw_event_id=raw_event.pk,
        request=request,
        event_type=event_type,
        device=device,
        payload_schema=payload_schema,
        created=created,
    )


def _process_raw_event(
    *,
    raw_event_id: UUID,
    request: IngestionRequest,
    event_type: EventType,
    device: Device | None,
    payload_schema: PayloadSchema | None,
    created: bool,
) -> IngestionResult:
    failure: IngestionError | None = None
    cause: Exception | None = None
    result: IngestionResult | None = None

    with transaction.atomic():
        raw_event = RawEvent.objects.select_for_update().get(pk=raw_event_id)
        _assert_same_envelope(
            raw_event=raw_event,
            request=request,
            event_type=event_type,
            device=device,
            payload_schema=payload_schema,
        )
        if raw_event.status == RawEvent.Status.PROCESSED:
            return _result_for_processed_event(raw_event, created=False)

        try:
            with transaction.atomic():
                result = _process_locked_event(
                    raw_event=raw_event,
                    device=device,
                    payload_schema=payload_schema,
                    created=created,
                )
        except Exception as error:
            cause = error
            failure = _normalize_processing_error(error, raw_event.pk)
            raw_event.refresh_from_db()
            _mark_failed(
                raw_event=raw_event,
                failure=failure,
                device=device,
                payload_schema=payload_schema,
            )

    if failure is not None:
        raise failure from cause
    if result is None:
        raise IngestionProcessingError(
            "Ingestion ended without a result.",
            raw_event_id=raw_event_id,
        )
    return result


def _process_locked_event(
    *,
    raw_event: RawEvent,
    device: Device | None,
    payload_schema: PayloadSchema | None,
    created: bool,
) -> IngestionResult:
    if device is None:
        raise UnknownDeviceError("Gateway has no device with supplied local ID.")
    if not device.is_active:
        raise InactiveDeviceError("Device is inactive.")
    if payload_schema is None:
        raise UnknownPayloadSchemaError(
            "No payload schema matches event type, device type, and version."
        )

    raw_event.device = device
    raw_event.payload_schema = payload_schema
    raw_event.status = RawEvent.Status.RECEIVED
    raw_event.parsing_error = ""
    raw_event.full_clean()
    raw_event.save(
        update_fields=("device", "payload_schema", "status", "parsing_error")
    )

    parsed_payload = parse_payload(payload_schema, raw_event.raw_payload)
    projection = project_readings(raw_event, parsed_payload)
    reading_ids: list[int] = []
    for reading in projection.readings:
        reading.save()
        reading_ids.append(reading.pk)

    raw_event.device_timestamp = projection.device_timestamp
    raw_event.status = RawEvent.Status.PROCESSED
    raw_event.parsing_error = ""
    raw_event.save(update_fields=("device_timestamp", "status", "parsing_error"))
    return IngestionResult(
        raw_event_id=raw_event.pk,
        status=raw_event.status,
        created=created,
        reading_ids=tuple(reading_ids),
    )


def _mark_failed(
    *,
    raw_event: RawEvent,
    failure: IngestionError,
    device: Device | None,
    payload_schema: PayloadSchema | None,
) -> None:
    raw_event.device = device
    raw_event.payload_schema = payload_schema
    raw_event.device_timestamp = None
    raw_event.status = RawEvent.Status.FAILED
    raw_event.parsing_error = f"{failure.code}: {failure}"[:MAX_FAILURE_DETAIL_LENGTH]
    raw_event.save(
        update_fields=(
            "device",
            "payload_schema",
            "device_timestamp",
            "status",
            "parsing_error",
        )
    )
    logger.warning(
        "Telemetry ingestion failed",
        extra={
            "raw_event_id": str(raw_event.pk),
            "ingestion_error_code": failure.code,
        },
    )


def _normalize_processing_error(
    error: Exception,
    raw_event_id: UUID,
) -> IngestionError:
    if isinstance(error, IngestionError):
        error.raw_event_id = raw_event_id
        return error
    if isinstance(error, ValidationError):
        return IngestionProcessingError(
            "Stored telemetry configuration failed validation.",
            raw_event_id=raw_event_id,
        )
    if isinstance(error, IntegrityError):
        return IngestionProcessingError(
            "Database rejected projected telemetry.",
            raw_event_id=raw_event_id,
        )

    logger.exception(
        "Unexpected telemetry ingestion failure",
        extra={"raw_event_id": str(raw_event_id)},
    )
    return IngestionProcessingError(
        "Unexpected telemetry ingestion failure.",
        raw_event_id=raw_event_id,
    )


def _result_for_processed_event(
    raw_event: RawEvent,
    *,
    created: bool,
) -> IngestionResult:
    reading_ids = tuple(
        ParameterReading.objects.filter(raw_event=raw_event)
        .order_by("pk")
        .values_list("pk", flat=True)
    )
    return IngestionResult(
        raw_event_id=raw_event.pk,
        status=raw_event.status,
        created=created,
        reading_ids=reading_ids,
    )


def _assert_same_envelope(
    *,
    raw_event: RawEvent,
    request: IngestionRequest,
    event_type: EventType,
    device: Device | None,
    payload_schema: PayloadSchema | None,
) -> None:
    conflicts = (
        raw_event.received_gateway_uid != request.gateway_uid
        or raw_event.received_local_id != request.device_local_id
        or raw_event.received_schema_version != request.schema_version
        or raw_event.event_type_id != event_type.pk
        or raw_event.raw_payload != request.payload
        or (
            raw_event.device_id is not None
            and (device is None or raw_event.device_id != device.pk)
        )
        or (
            raw_event.payload_schema_id is not None
            and (
                payload_schema is None
                or raw_event.payload_schema_id != payload_schema.pk
            )
        )
    )
    if conflicts:
        raise IdempotencyConflictError(
            "Message ID was already used for a different event envelope.",
            raw_event_id=raw_event.pk,
        )


def _get_gateway(uid: str) -> Gateway:
    try:
        gateway = Gateway.objects.get(uid=uid)
    except Gateway.DoesNotExist as error:
        raise UnknownGatewayError("Gateway UID is unknown.") from error
    if not gateway.is_active:
        raise InactiveGatewayError("Gateway is inactive.")
    return gateway


def _get_event_type(code: str) -> EventType:
    try:
        return EventType.objects.get(code=code)
    except EventType.DoesNotExist as error:
        raise UnknownEventTypeError("Event type code is unknown.") from error


def _get_payload_schema(
    *,
    event_type: EventType,
    device: Device | None,
    version: int,
) -> PayloadSchema | None:
    if device is None:
        return None
    return PayloadSchema.objects.filter(
        event_type=event_type,
        device_type_id=device.device_type_id,
        version=version,
    ).first()


def _validate_request(request: IngestionRequest) -> None:
    _require_text("gateway_uid", request.gateway_uid, max_length=64)
    _require_text("device_local_id", request.device_local_id, max_length=64)
    _require_text("event_type_code", request.event_type_code, max_length=64)
    _require_text("message_id", request.message_id, max_length=128)
    if type(request.schema_version) is not int or request.schema_version <= 0:
        raise InvalidIngestionRequestError("Schema version must be a positive integer.")
    if not isinstance(request.payload, str):
        raise InvalidIngestionRequestError("Payload must be a string.")
    try:
        payload_size = len(request.payload.encode("utf-8"))
    except UnicodeEncodeError as error:
        raise InvalidIngestionRequestError(
            "Payload must be valid UTF-8 text."
        ) from error
    if payload_size > MAX_PAYLOAD_BYTES:
        raise InvalidIngestionRequestError(
            f"Payload exceeds {MAX_PAYLOAD_BYTES} byte limit."
        )


def _require_text(name: str, value: object, *, max_length: int) -> None:
    if not isinstance(value, str) or not value:
        _invalid_request(f"{name} must be a non-empty string.")
    if len(value) > max_length:
        _invalid_request(f"{name} exceeds {max_length} characters.")


def _invalid_request(message: str) -> NoReturn:
    raise InvalidIngestionRequestError(message)
