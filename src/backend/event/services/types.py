from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class IngestionRequest:
    gateway_uid: str
    device_local_id: str
    event_type_code: str
    schema_version: int
    message_id: str
    payload: str


@dataclass(frozen=True, slots=True)
class IngestionResult:
    raw_event_id: UUID
    status: str
    created: bool
    reading_ids: tuple[int, ...]
