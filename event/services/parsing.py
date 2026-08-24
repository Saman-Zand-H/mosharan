from dataclasses import dataclass
from typing import TypeAlias

from event.models import PayloadField, PayloadSchema

from .exceptions import PayloadParsingError

WireValue: TypeAlias = int | str | bool


@dataclass(frozen=True, slots=True)
class ParsedPayload:
    values_by_field_id: dict[int, WireValue]


def parse_payload(schema: PayloadSchema, payload: str) -> ParsedPayload:
    try:
        payload_bytes = payload.encode(schema.encoding)
    except (LookupError, UnicodeEncodeError) as error:
        raise PayloadParsingError("Payload schema encoding is invalid.") from error
    if (
        schema.expected_length is not None
        and len(payload_bytes) != schema.expected_length
    ):
        raise PayloadParsingError(
            f"Payload must contain {schema.expected_length} bytes; "
            f"received {len(payload_bytes)}."
        )

    values: dict[int, WireValue] = {}
    fields = PayloadField.objects.filter(payload_schema=schema).order_by(
        "start_byte", "id"
    )
    for field in fields:
        if field.end_byte > len(payload_bytes):
            raise PayloadParsingError(f"Payload is too short for field {field.code!r}.")
        segment = payload_bytes[field.start_byte : field.end_byte]
        values[field.pk] = _decode_field(field, segment)

    return ParsedPayload(values_by_field_id=values)


def _decode_field(field: PayloadField, segment: bytes) -> WireValue:
    try:
        if field.wire_codec == PayloadField.WireCodec.INTEGER:
            decoded = segment.decode("ascii").strip()
            if not decoded:
                raise ValueError("empty integer")
            return int(decoded)
        if field.wire_codec == PayloadField.WireCodec.UTF8:
            return segment.decode("utf-8")
        if field.wire_codec == PayloadField.WireCodec.BOOLEAN:
            token = segment.decode("ascii").strip().lower()
            if token in {"1", "true"}:
                return True
            if token in {"0", "false"}:
                return False
            raise ValueError("invalid boolean token")
    except (UnicodeDecodeError, ValueError) as error:
        raise PayloadParsingError(
            f"Could not decode payload field {field.code!r}."
        ) from error

    raise PayloadParsingError(f"Unsupported wire codec for field {field.code!r}.")
