# Telemetry Ingest API

Reference for `POST /api/v1/ingest`, the endpoint hardware gateways call to
deliver one telemetry event. The gateway sends a single JSON envelope holding
identity metadata plus a schema-encoded payload string; the server persists the
raw event first, then parses and projects it into typed parameter readings.

The same behavior is available transport-independently through
`event.services.ingest_event` (see the backend README) and is exercised by the
in-app receive simulator. This document covers the HTTP surface.

- [Endpoint](#endpoint)
- [Authentication](#authentication)
- [Request body](#request-body)
- [Payload wire format](#payload-wire-format)
- [Processing semantics](#processing-semantics)
- [Responses](#responses)
- [Idempotency and retries](#idempotency-and-retries)
- [Worked example](#worked-example)

## Endpoint

| Attribute    | Value                                             |
| ------------ | ------------------------------------------------- |
| Method       | `POST`                                            |
| Path         | `/api/v1/ingest`                                  |
| Content type | `application/json`                                |
| Auth         | Gateway bearer token (see below), no CSRF token   |
| Success      | `201` new event, `200` idempotent retry           |

Production serves the endpoint at `https://app.mosharanco.com/api/v1/ingest`;
a local dev server serves it at `http://127.0.0.1:8765/api/v1/ingest`. Use
HTTPS for any non-local deployment — the bearer token must not cross the
network in cleartext.

## Authentication

Every request carries two credentials:

| Header            | Value                    | Notes                                    |
| ----------------- | ------------------------ | ---------------------------------------- |
| `Authorization`   | `Bearer <gateway-token>` | Opaque per-gateway token, ≤256 chars     |
| `X-Gateway-UID`   | Gateway UID              | ≤64 chars; selects the gateway row       |

The server looks up the gateway by `X-Gateway-UID`, requires it to be active,
and verifies the token against a stored hash (Django password hashing). The
token never encodes identity, so it can be rotated independently of the UID.
Gateway identity is always taken from these headers, never from the JSON body.

A missing `X-Gateway-UID`, an unknown or inactive gateway UID, or a wrong or
rotated token all return the same opaque response:

```json
HTTP/1.1 401 Unauthorized
{ "code": "unauthorized", "message": "Authentication is required." }
```

### Token issuance and rotation

Tokens are issued by a platform administrator (superuser session) via:

```
POST /api/v1/management/gateways/{id}/ingest-token
```

In the UI this is **Platform management → Gateways → issue token**. Each call
generates a new 16-character `secrets.token_urlsafe(12)` value, stores only its
hash, and returns the plaintext exactly once:

```json
{
  "gatewayId": 3,
  "gatewayUid": "DEMO-GW-001",
  "token": "gK8w...one-time-plaintext"
}
```

Calling it again rotates the token; the previous token stops working
immediately. There is no way to recover a lost plaintext — only to rotate.

## Request body

All fields are required; unknown fields are rejected. Field names are
camelCase throughout the API.

| Field           | Type   | Constraints                  | Meaning                          |
| --------------- | ------ | ---------------------------- | -------------------------------- |
| `deviceLocalId` | string | 1–64 chars                   | Device ID local to this gateway  |
| `eventTypeCode` | string | 1–64 chars                   | Event type code, e.g. `telemetry`|
| `schemaVersion` | int    | ≥ 1                          | Payload schema version           |
| `messageId`     | string | 1–128 chars                  | Unique per gateway (see below)   |
| `payload`       | string | 1–65536 chars, ≤64 KiB UTF-8 | Schema-encoded payload bytes     |

`deviceLocalId` is resolved against the authenticated gateway only: two
gateways may each own a device called `sensor-001`. The device must exist and
be active, and a `PayloadSchema` row must exist for the event type, the
device's type, and the requested version.

## Payload wire format

The `payload` string is a fixed-layout byte buffer transmitted as UTF-8 text.
Its structure is defined by database rows, not by the request:

- `PayloadSchema` — keyed by (event type, device type, version); may pin
  `expectedLength`, the exact byte count after encoding.
- `PayloadField` — one row per field with `startByte`/`endByte` half-open
  ranges `[start, end)`, a wire codec, and a role.
- `ProjectionRule` — maps each field (or a constant) to a parameter reading,
  with `conversionConfig` for datetime rules.

Three wire codecs are supported:

| Codec    | Decoding                                                        |
| -------- | --------------------------------------------------------------- |
| `integer`| ASCII text, whitespace stripped, parsed as decimal integer      |
| `utf8`   | Raw UTF-8 text slice                                            |
| `boolean`| ASCII, case-insensitive: `1`/`true` → true, `0`/`false` → false |

Bytes not covered by any field are ignored, so layouts can include filler or
alignment gap bytes. When `expectedLength` is set, the encoded payload must
match it exactly — no padding, no truncation.

## Processing semantics

One request is processed as an atomic, raw-first unit:

1. **Authenticate** the gateway (token + UID headers).
2. **Validate** the envelope and resolve the event type, the device by
   (`gateway`, `deviceLocalId`), and the payload schema by
   (`eventTypeCode`, device type, `schemaVersion`).
3. **Persist the raw event** before any parsing, keyed by
   (`gateway`, `messageId`).
4. **Parse** the payload into fields using the schema's byte layout.
5. **Project** each projection rule into a `ParameterReading`.
6. **Mark processed** and return the new reading IDs.

`observedAt` for every reading is the projected device timestamp when the
schema defines a timestamp field, otherwise the server receive time.
Datetime rules convert Unix seconds by default, or milliseconds when the
rule's `conversionConfig` sets `timestampUnit` to `milliseconds`.

If parsing or projection fails, the raw event is **retained** with
`status: "failed"` and a `parsingError` of the form `code: message`, so
mis-encoded events stay inspectable and reprocessing stays possible. Failures
that occur before the raw event exists (unknown event type, envelope
validation) are rejected without storing anything.

## Responses

### Success

```json
HTTP/1.1 201 Created
{
  "rawEventId": "0f0f3a1e-6d4a-4d15-9a2f-5e0c9b8f7a11",
  "status": "processed",
  "created": true,
  "readingIds": [101, 102, 103, 104]
}
```

| Field        | Type      | Meaning                                        |
| ------------ | --------- | ---------------------------------------------- |
| `rawEventId` | UUID      | Stored raw event (immutable, queryable)        |
| `status`     | string    | `processed` on success                         |
| `created`    | boolean   | `true` for a new event, `false` on retry       |
| `readingIds` | int[]     | Parameter reading primary keys, insertion order|

An exact retry of an already-processed message returns `200` with
`created: false` and the **same** `readingIds` — no duplicate data.

### Errors

All errors share the problem shape `{code, message, fields?}`, with `fields`
present only for schema-validation problems:

| HTTP | `code`                  | Cause                                                  |
| ---- | ----------------------- | ------------------------------------------------------ |
| 401  | `unauthorized`          | Bad token/UID headers, or unknown/inactive gateway     |
| 409  | `idempotency_conflict`  | `messageId` reused with a different envelope           |
| 422  | `validation_error`      | Body fails schema validation (with `fields` map)       |
| 422  | `invalid_request`       | Payload exceeds 64 KiB when UTF-8 encoded              |
| 422  | `unknown_event_type`    | `eventTypeCode` matches no event type (not stored)     |
| 422  | `unknown_device`        | Gateway has no device with this `deviceLocalId`        |
| 422  | `inactive_device`       | Device exists but is inactive                          |
| 422  | `unknown_payload_schema`| No schema for event type + device type + version       |
| 422  | `payload_parsing_error` | Wrong byte length or undecodable field segment         |
| 422  | `projection_error`      | Value type mismatch or timestamp out of range          |
| 422  | `processing_error`      | Unexpected failure (configuration or internal)         |

Except for `unauthorized`, `idempotency_conflict`, `unknown_event_type`, and
`validation_error`, the failed raw event is retained as described above.

```json
HTTP/1.1 422 Unprocessable Content
{
  "code": "payload_parsing_error",
  "message": "Payload must contain 20 bytes; received 19."
}
```

```json
HTTP/1.1 409 Conflict
{
  "code": "idempotency_conflict",
  "message": "Message ID was already used for a different event envelope."
}
```

## Idempotency and retries

The pair (`gateway`, `messageId`) is unique — a gateway may never reuse a
message ID for a different envelope. The envelope covers device local ID,
event type, schema version, and the payload bytes.

- **Exact retry** (e.g. after a network timeout): returns `200` with the
  original `rawEventId` and `readingIds`. Retrying is always safe.
- **Changed payload under the same `messageId`**: `409 idempotency_conflict`.

Devices should derive `messageId` from a monotonic source, such as
`{deviceLocalId}-{sequence}` or `{deviceLocalId}-{unixTime}`, so replays after
reconnects stay identical while new events never collide.

## Worked example

Against the demo data created by `seed_demo_data` (gateway `DEMO-GW-001`,
device `sensor-001`, event type `telemetry`, schema version 1 — 20 bytes):

| Bytes   | Field       | Codec    | Example segment | Decoded                    |
| ------- | ----------- | -------- | --------------- | ---------------------------|
| 0–10    | `timestamp` | integer  | `1724937600`    | 2024-08-29 13:20:00 UTC    |
| 10–14   | `temperature`| integer | `0025`          | 25                         |
| 14–18   | `humidity`  | integer  | `0064`          | 64                         |
| 18–20   | `battery_ok`| boolean | `1 `            | true                       |

```bash
curl -X POST https://app.mosharanco.com/api/v1/ingest \
  -H 'Authorization: Bearer <gateway-token>' \
  -H 'X-Gateway-UID: DEMO-GW-001' \
  -H 'Content-Type: application/json' \
  --data '{
    "deviceLocalId": "sensor-001",
    "eventTypeCode": "telemetry",
    "schemaVersion": 1,
    "messageId": "sensor-001-1724937600",
    "payload": "1724937600002500641 "
  }'
```

The trailing space in the payload is the padding byte of the boolean segment
(`1 ` strips to `1` → true) and is required to reach the 20-byte length.

Interactive OpenAPI documentation is served at `/api/v1/docs`. For the
raw-first storage and transaction rationale see
[ADR-002](decisions/0002-raw-first-ingestion-service.md); for the data model
see [ADR-001](decisions/0001-immutable-events-and-typed-eav.md). The receive
simulator (superuser-only) builds valid payloads from the same database
configuration via `/api/v1/simulator/catalog`.
