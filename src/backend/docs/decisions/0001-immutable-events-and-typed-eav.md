# ADR-001: Preserve raw events and project typed EAV readings

## Status

Accepted

## Date

2026-08-24

## Context

Gateways relay fixed-format UTF-8 payloads from locally identified devices.
Payload layouts vary by event type, device type, and protocol version. Several
event types may update the same device parameter, and parameter history must
remain queryable after parsing rules change.

## Decision

Persist every incoming message as an immutable `RawEvent` before parsing. Decode
it with a versioned `PayloadSchema` whose `PayloadField` offsets are half-open
UTF-8 byte ranges. Use `ProjectionRule` rows to map either decoded fields or
event-implied constants to global `ParameterDefinition` rows.

The database records are the runtime schema authority. Spreadsheets and firmware
documents may help operators create or review those records, but ingestion never
loads or infers a schema from an external document.

Store resulting history as append-only `ParameterReading` rows. Each row has
exactly one typed value column: integer, datetime, string, or boolean. Preserve
its source event and optional projection rule for provenance.

Treat gateway UID as hardware identity, not authentication. Device identity is
unique within a gateway through `(gateway, local_id)`.

## Alternatives considered

### EAV readings as source of truth

Rejected. Parser defects or schema changes would be impossible to audit or
reprocess without original payloads.

### One JSON value column

Rejected. JSON weakens database type constraints and makes time-series filters,
ordering, and indexing harder.

### One table per parameter type or metric

Rejected. Every new parameter would create schema and query churn. Controlled
typed EAV keeps attributes configurable while retaining value constraints.

### Unicode character offsets

Rejected. Firmware protocols operate on bytes; UTF-8 characters can occupy
multiple bytes and make character offsets ambiguous.

## Consequences

- Raw events support retries, audit, and reprocessing.
- Schema versions and projection provenance explain historical readings.
- Database constraints enforce local device identity, idempotency, valid byte
  ranges, projection source shape, and exactly one reading value.
- Cross-table semantic rules still require model or ingestion validation.
- Retention and partitioning remain separate decisions. Gateway authentication
  and the HTTP ingestion adapter are implemented separately from the model
  design: per-Gateway bearer tokens protect `POST /api/v1/ingest`.
