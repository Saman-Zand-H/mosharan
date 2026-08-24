# Device Telemetry Backend

Django backend for registering microcontroller installations and retaining raw
telemetry plus typed parameter history.

## Run locally

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

## Development checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run pyrefly check --min-severity warn
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
```

## Language and accounts

Persian (`fa`) is the default language. Requests can select English with the
`Accept-Language: en` header.

The custom `account.User` model uses `username` as its login identifier and
inherits Django's `AbstractBaseUser` and `PermissionsMixin`. Email is required,
unique, and normalized by Django's user manager. No login or account API
endpoints exist yet.

Set `DJANGO_SECRET_KEY` before running outside local development.

## Architecture

- `device`: gateways, devices, device types, and parameter catalog
- `event`: event types, versioned byte-layout schemas, immutable raw events, and
  typed EAV parameter readings
- `account`: custom Django user model

See [ADR-001](docs/decisions/0001-immutable-events-and-typed-eav.md) for data
model rationale and [CONTEXT.md](CONTEXT.md) for domain language.

## Ingestion service

Use the transport-independent service after authenticating the gateway:

```python
from event.services import IngestionRequest, ingest_event

result = ingest_event(
    IngestionRequest(
        gateway_uid="gateway-001",
        device_local_id="sensor-1",
        event_type_code="metrics",
        schema_version=1,
        message_id="message-123",
        payload="17200000000251",
    )
)
```

The service stores raw input before parsing, prevents conflicting message-ID
reuse, returns existing readings for processed retries, and retains failed raw
events for later reprocessing. Payloads are limited to 64 KiB. Boolean fields
accept `0`, `1`, `false`, or `true`; datetime rules use Unix seconds unless
`conversion_config` sets `timestamp_unit` to `milliseconds`.

See [ADR-002](docs/decisions/0002-raw-first-ingestion-service.md) for transaction
and retry behavior.

HTTP ingestion endpoints and gateway authentication are not implemented yet.
Do not expose this project as a receiver before adding them.
