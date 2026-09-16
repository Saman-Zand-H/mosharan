# ADR-002: Use raw-first idempotent ingestion

## Status

Accepted

## Date

2026-08-24

## Context

Parsing can fail because a device or schema is missing, payload bytes are
malformed, or projection configuration is invalid. Those failures must not erase
the received payload. Gateway retries must not create duplicate events or
parameter readings.

## Decision

Expose one orchestration interface:

```python
ingest_event(request: IngestionRequest) -> IngestionResult
```

The caller authenticates the gateway. The service then validates active registry
identity and stores `RawEvent` using unique `(gateway, message_id)` idempotency
before parsing begins. A reused message ID must match gateway UID, local device
ID, event type, requested schema version, and raw payload.

Processing locks the raw-event row and runs parsing plus all reading writes in a
nested atomic block. Any failure rolls that block back, then commits a failed
status and bounded error detail on the already-persisted raw event. A retry can
reprocess a failed event after missing device or schema configuration is added.

Byte parsing and typed projection remain separate modules behind the ingestion
interface. Fixed fields use half-open UTF-8 byte offsets. Boolean tokens accept
`0`, `1`, `false`, and `true`. Datetime projections interpret integer timestamps
as seconds unless a rule selects milliseconds. Requests are capped at 64 KiB.

## Alternatives considered

### One transaction for raw event and readings

Rejected. A parsing failure would roll back the raw evidence that enables audit
and reprocessing.

### Parsing in the HTTP handler

Rejected. It would spread transaction, retry, and projection rules across each
transport adapter and make background reprocessing harder.

### Silently reuse any matching message ID

Rejected. Reusing an idempotency key with different envelope content can hide
device defects or tampering.

## Consequences

- HTTP and future queue adapters can call the same small interface.
- Processed retries return existing reading IDs without duplication.
- Failed raw events remain inspectable and recoverable.
- `select_for_update()` provides real row locking only on supported databases;
  SQLite development runs do not prove production concurrency behavior.
- Gateway token authentication and HTTP status mapping remain transport
  concerns. The implemented HTTP adapter is `POST /api/v1/ingest`; it
  authenticates a gateway bearer token, passes the gateway identity into this
  service, and maps a new processed event to `201`, an identical processed
  retry to `200`, envelope conflicts to `409`, and ingestion/schema failures to
  `422`.
