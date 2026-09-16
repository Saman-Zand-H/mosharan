# ADR-004: Use Django sessions for the browser control plane

## Status

Accepted

## Date

2026-08-27

## Context

The React control plane needs authenticated access to company-scoped telemetry
metadata and a platform-administration workspace. Browser authentication must
not be confused with Gateway authentication: human users operate the control
plane, while hardware uses its own per-Gateway credential and request-integrity
boundary.

## Decision

Use Django's server-side session authentication for the browser API. Bootstrap a
CSRF token before login and require CSRF validation for login and every unsafe
session-authenticated request. Accept only active users. Limit login attempts to
10 per client IP over five minutes across both API and Django-admin login routes,
and return the same API invalid-credentials response for an unknown account or a
wrong password.

Use active `is_superuser` as the authorization boundary for
`/api/v1/management` and `/api/v1/simulator/catalog`. Platform Administrators
can manage ordinary users and configuration globally, but the API refuses to
mutate or delete platform-administrator accounts. Any active authenticated user
may load the read-only `/api/v1/workspace/catalog`; its devices are scoped
through `visible_to(user)`, and non-superusers receive schemas only for their
visible Device Types. The packet receive simulator remains an administrator
action because it is an operational tool, not a regular telemetry view.

## Alternatives considered

### Browser-managed bearer tokens

Rejected. Persisting browser credentials in JavaScript-accessible storage would
increase token-exfiltration risk without benefiting this same-origin control
plane.

### Treat `is_staff` as platform authorization

Rejected. Django staff status is an admin-site capability and is not the
platform's cross-company business authorization boundary.

### Reuse user sessions for Gateways

Rejected. Hardware identity, credential rotation, replay resistance, and request
integrity have different requirements and remain a separate decision.

## Consequences

- The frontend must send cookies with API requests and attach the CSRF token to
  mutations.
- Session and CSRF cookie security settings must be hardened for HTTPS before
  production deployment.
- Management routes fail closed for anonymous, inactive, ordinary, and staff-only
  accounts.
- Domain records are read-only in Django admin; validated management services are
  the mutation boundary. User and Group administration remains available for
  platform-account maintenance.
- Login throttling uses Django's cache and needs a shared production cache when
  the API runs on multiple processes or hosts.
- Hardware uses a separate per-Gateway bearer token at `POST /api/v1/ingest`;
  browser sessions are never accepted for ingestion. Tokens are stored as
  hashes, rotated by platform administrators, and returned in plaintext only
  during the rotation response. HTTPS remains required outside local
  development.
