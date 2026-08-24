from uuid import UUID


class IngestionError(Exception):
    code = "ingestion_error"

    def __init__(self, message: str, *, raw_event_id: UUID | None = None) -> None:
        super().__init__(message)
        self.raw_event_id = raw_event_id


class InvalidIngestionRequestError(IngestionError):
    code = "invalid_request"


class UnknownGatewayError(IngestionError):
    code = "unknown_gateway"


class InactiveGatewayError(IngestionError):
    code = "inactive_gateway"


class UnknownEventTypeError(IngestionError):
    code = "unknown_event_type"


class UnknownDeviceError(IngestionError):
    code = "unknown_device"


class InactiveDeviceError(IngestionError):
    code = "inactive_device"


class UnknownPayloadSchemaError(IngestionError):
    code = "unknown_payload_schema"


class IdempotencyConflictError(IngestionError):
    code = "idempotency_conflict"


class PayloadParsingError(IngestionError):
    code = "payload_parsing_error"


class ProjectionError(IngestionError):
    code = "projection_error"


class IngestionProcessingError(IngestionError):
    code = "processing_error"
