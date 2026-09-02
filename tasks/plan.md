# Implementation Plan: Database-driven telemetry dashboard

## Objective

Replace decorative dashboard values with authenticated, tenant-scoped telemetry
data. Let platform administrators define visualization tabs and charts in the
database, and show boolean parameters as both current state and history.

## Decisions

- `VisualizationTab` groups visualizations and is scoped to a device type.
- `Visualization` stores title, chart type, X-axis parameter (nullable for
  observed time), Y-axis parameter, order, and active state.
- Dashboard selects one visible device; its device type determines tabs.
- Numeric readings feed charts. Boolean readings feed latest-state tiles and
  chronological history.
- Superusers manage configuration. Reads are session-authenticated and tenant
  scoped.

## Dependency order

1. Models, validation, migration, admin/API DTOs.
2. Dashboard read endpoint and management CRUD/snapshot support.
3. Demo seed configuration and readings.
4. API-backed overview, tabs, charts, and binary panels.
5. Management UI and full verification.

## Acceptance criteria

- Dashboard no longer uses hard-coded KPI/chart/gateway/event values for live
  state.
- Superuser can create/update/delete tabs and visualizations; invalid axis or
  device-type combinations fail validation.
- Company user sees only visible devices, tabs, charts, and readings.
- Chart title/type/axes come from database configuration.
- Every visible boolean parameter has a green/red latest tile and history.
- Existing auth, simulator, and platform-management flows remain functional.

## Verification

```bash
uv run --directory src/backend python manage.py makemigrations --check --dry-run
uv run --directory src/backend python manage.py check
uv run --directory src/backend ruff check .
uv run --directory src/backend pyrefly check --min-severity warn
uv run --directory src/backend python manage.py test
npm --prefix src/frontend run lint
npm --prefix src/frontend run build
```

## Boundaries

- Preserve tenant scoping and immutable raw-event history.
- Validate axes against parameters assigned to the tab device type.
- Never expose another company's readings.
- Use management-command seeding, never a data migration.
