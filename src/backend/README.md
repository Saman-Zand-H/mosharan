# Device Telemetry Backend

Django backend for registering microcontroller installations and retaining raw
telemetry plus typed parameter history.

## Run locally

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py seed_demo_data
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
unique, and normalized by Django's user manager. Each `Company` has exactly one
User, and a User can represent at most one Company. Platform administrators use
`is_superuser`; `is_staff` does not grant cross-company access.

Set `DJANGO_SECRET_KEY` before running outside local development.

For a production settings check, disable debug and provide the deployment host
and a generated secret:

```bash
DJANGO_DEBUG=false \
DJANGO_SECRET_KEY='replace-with-a-long-random-value' \
DJANGO_ALLOWED_HOSTS='telemetry.example.com' \
uv run python manage.py check --deploy
```

With debug disabled, secure session and CSRF cookies, HTTPS redirects, and a
one-hour initial HSTS policy are enabled. Configure
`DJANGO_CSRF_TRUSTED_ORIGINS` when the public HTTPS origin differs from the
request host. Increase HSTS duration and opt into subdomains/preload only after
the HTTPS deployment is verified.

## HTTP API

Django Ninja serves the API, interactive documentation, and OpenAPI document at
`/api/v1/`, `/api/v1/docs`, and `/api/v1/openapi.json`, respectively. Request and
response field names use camelCase. Errors use
`{"code": "...", "message": "...", "fields": {...}}`, with `fields` omitted
when no field-level details exist.

- `/api/v1/auth/*`: CSRF bootstrap, login, logout, and current-session identity
- `/api/v1/management/*`: superuser-only CRUD for registry and payload
  configuration
- `/api/v1/management/visualization-tabs` and
  `/api/v1/management/visualizations`: superuser-only dashboard configuration
- `/api/v1/simulator/catalog`: superuser-only database-defined devices and
  payload schemas used by the receive simulator
- `/api/v1/workspace/catalog`: authenticated, tenant-scoped read-only device and
  payload metadata for regular module pages
- `/api/v1/dashboard`: authenticated, tenant-scoped dashboard projection for a
  selected device, configured tabs/charts, numeric history, and boolean latest
  values/history

Authentication uses Django's server-side session cookie. Unsafe requests require
a valid CSRF token. Only active `is_superuser` accounts may access management
and simulator routes; company users can access only their own workspace catalog
and telemetry data.

The Django admin is also superuser-only. Domain and telemetry records are
read-only there so direct ModelAdmin saves cannot bypass management-service
history safeguards; User and Group administration remains available for
platform-account bootstrap and maintenance.

## Architecture

- `device`: optionally company-owned gateways, devices, device types, and
  parameter catalog
- `event`: event types, versioned byte-layout schemas, database-defined
  dashboard tabs/charts, immutable raw events, and typed EAV parameter readings
- `account`: custom Django user model and one-to-one companies

See [ADR-001](docs/decisions/0001-immutable-events-and-typed-eav.md) for data
model rationale and [CONTEXT.md](../../CONTEXT.md) for domain language.

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

## Company access

A Gateway may belong to one Company or remain unassigned. Device, RawEvent, and
ParameterReading ownership is derived through the Gateway; those tables do not
duplicate a company foreign key. Human-facing query code must start from the
shared scope:

```python
Company.objects.visible_to(request.user)
Gateway.objects.visible_to(request.user)
Device.objects.visible_to(request.user)
RawEvent.objects.visible_to(request.user)
ParameterReading.objects.visible_to(request.user)
```

Active superusers see every record, including unassigned gateways. Active
company users see only their own chain. Anonymous, inactive, and company-less
users receive empty querysets. Object endpoints should return 404 when a record
is absent from the scoped queryset, and must never trust a client-supplied
`company_id` as authorization evidence.

See [ADR-003](docs/decisions/0003-company-tenancy-boundary.md) for the ownership
boundary, fail-closed rules, and gateway-transfer consequence.

See [ADR-004](docs/decisions/0004-browser-session-authentication.md) for browser
session authentication, CSRF, throttling, and the platform-management boundary.

Payload schemas are configured by database `PayloadSchema`, `PayloadField`, and
`ProjectionRule` rows. External spreadsheets can inform that configuration but
are not runtime schema authorities.

Dashboard layout is configured by `VisualizationTab` and `Visualization` rows.
Tabs belong to a device type; visualizations select a chart type, optional
parameter X-axis (`null` means `observed_at`), and numeric/datetime Y-axis.
Boolean parameters are not chart axes: the dashboard returns their latest value
and bounded chronological history for status tiles and a 0/1 connection diagram
(`1 = connected`, `0 = disconnected`). See
[ADR-005](docs/decisions/0005-database-driven-dashboard-visualizations.md) for
the design rationale.

The demo seed command creates a rolling seven-day hourly history for the sample
devices, so the dashboard's 6-hour, 24-hour, and 7-day ranges all have useful
temperature and humidity points. Binary fixture values are derived from the
absolute device hour, so rerunning after the window advances does not create an
idempotency conflict. Re-running the command fills only missing hour/device
message IDs and does not duplicate existing readings.

HTTP ingestion endpoints and gateway authentication are not implemented yet.
Do not expose this project as a receiver before adding them.
