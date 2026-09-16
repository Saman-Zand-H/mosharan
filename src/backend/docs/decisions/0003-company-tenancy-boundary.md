# ADR-003: Scope company data through gateway ownership

## Status

Accepted

## Date

2026-08-26

## Context

The platform serves multiple Companies. Each Company is represented by one
User, while the operator needs a platform administrator with global access.
Gateways can be provisioned before assignment, and all Devices, RawEvents, and
ParameterReadings already form one ownership chain beneath a Gateway.

## Decision

Model `Company.user` as a required one-to-one relationship and
`Gateway.company` as an optional protected foreign key. Derive access to Devices,
RawEvents, and ParameterReadings through the Gateway rather than copying a
company ID onto every table.

Use active `is_superuser` accounts as Platform Administrators. They see all
Companies and data, including unassigned Gateways. Active non-superusers use the
shared `visible_to(user)` queryset and see only records whose Gateway belongs to
their Company. Anonymous, inactive, and company-less users see nothing.

## Alternatives considered

### Company foreign keys on every telemetry table

Rejected. Duplicated ownership columns can drift from the Gateway relationship
and create cross-company data leaks.

### Treat Django staff as platform administrators

Rejected. `is_staff` controls Django-admin eligibility and is not a business
authorization boundary.

### Expose unassigned Gateways to every Company

Rejected. Provisioning state must fail closed; only a Platform Administrator can
see or assign an unowned Gateway.

## Consequences

- Deleting a Company or its User is protected while ownership references exist.
- Hardware ingestion remains independent of Company-user authorization and can
  accept both assigned and unassigned Gateways through the gateway-token
  authenticated `POST /api/v1/ingest` endpoint.
- Reassigning a Gateway changes visibility of its complete historical telemetry.
  The management API permits assigning an unassigned Gateway, but rejects
  changing or clearing an existing Company with `gateway_transfer_blocked`
  until an explicit transfer policy exists.
- Tenant-facing object APIs must fetch from `visible_to(user)` and return 404 for
  foreign-company or unassigned resources. Superuser-only platform-management
  endpoints are intentionally global.
