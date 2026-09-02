# Device Telemetry Platform

Monorepo for receiving microcontroller telemetry and operating the fleet.

## Structure

```text
src/
├── backend/   Django, Django Ninja, telemetry models, ingestion services
└── frontend/  React, TypeScript, Vite
```

Shared domain language lives in [CONTEXT.md](CONTEXT.md). The data model lives in
[Internship.drawio.xml](Internship.drawio.xml).

Companies are one-to-one with their regular users and may own multiple
gateways. Gateway ownership is optional; unassigned gateways are visible only to
platform superusers. Device and telemetry access is derived through the gateway
instead of duplicating company IDs across the history tables.

## Backend

Quick local start (after seeding once):

```bash
./run.sh
```

If the default ports are occupied:

```bash
BACKEND_PORT=8765 FRONTEND_PORT=5174 ./run.sh
```

```bash
uv sync --directory src/backend --locked
uv run --directory src/backend python manage.py migrate
uv run --directory src/backend python manage.py createsuperuser
uv run --directory src/backend python manage.py runserver
```

Backend checks:

```bash
uv run --directory src/backend ruff check .
uv run --directory src/backend ruff format --check .
uv run --directory src/backend pyrefly check --min-severity warn
uv run --directory src/backend python manage.py check
uv run --directory src/backend python manage.py makemigrations --check --dry-run
```

## Frontend

```bash
cd src/frontend
# Requires Node.js ^20.19.0 or >=22.12.0.
npm ci
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set
`VITE_BACKEND_PROXY_TARGET` when Django listens elsewhere, for example
`VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8765 npm run dev`.

Frontend checks:

```bash
npm run lint
npm run build
```

## Dashboard configuration

The overview dashboard reads its device, tab, visualization, chart points, and
boolean state from Django. Seed local data after migrations:

```bash
uv run --directory src/backend python manage.py seed_demo_data
```

The seed command is safe to rerun and preserves existing configuration edits. It
ensures sample environment and voltage tabs, line/area/bar visualizations,
seven days of hourly numeric/boolean readings for both demo devices, and a
current dashboard sample bucket. Binary values are derived from the absolute
device hour, so advancing the rolling window does not change an existing event
payload. The first run creates the local `demo` account
and prints its password. Use
`--reset-password --password <value>` only when you intentionally need to
change that account.

Platform administrators manage dashboard configuration in **Platform
management → Dashboard**:

- **Dashboard tabs**: device type, code, title, order, active state
- **Visualizations**: tab, title, chart type, X-axis, Y-axis, order, active state

An empty X-axis means `observed_at`. X/Y parameter choices are restricted to
parameters assigned to the tab's device type. Dashboard reads are available at
`GET /api/v1/dashboard?deviceId=<id>&hours=<1..720>` and remain tenant-scoped.
Boolean parameters render a green/red latest-value tile and a chronological
history diagram below it; the diagram uses `1 = متصل` and `0 = قطع`.

The overview dashboard now uses the database-backed dashboard API. The overview
summary remains intentionally small; authentication, platform management, and
simulator configuration use the Django API.

The **Receive simulator** is available only to platform administrators. It
loads database-defined `PayloadSchema`, `PayloadField`, and `ProjectionRule`
records from `/api/v1/simulator/catalog`, then generates and parses exact-width
UTF-8 packets locally without persisting a `RawEvent`. Regular company users'
read-only module pages use `/api/v1/workspace/catalog` and cannot open the
simulator.
`sample_packets.xlsx` is reference material only and never controls runtime
schema behavior.

Active superusers can use **Platform management** to manage users, companies,
gateways, devices, device types, parameters, parameter assignments, event types,
payload schemas, payload fields, projection rules, dashboard tabs, and
visualizations. Regular company users do not receive this navigation entry or
access to its API endpoints.
