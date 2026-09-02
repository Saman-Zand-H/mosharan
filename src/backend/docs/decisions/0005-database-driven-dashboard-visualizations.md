# ADR-005: Database-driven dashboard visualizations

## Status

Accepted

## Context

The dashboard currently renders fixed frontend values. Device metrics and
boolean states need to change without a frontend release, and operators need
to group related metrics such as voltage channels under a named tab.

## Decision

Add `VisualizationTab`, scoped to a device type, and `Visualization`, belonging
to a tab. A visualization stores a title, chart type, optional X-axis
parameter (null means observed time), Y-axis parameter, order, and active flag.
Only parameters assigned to the tab's device type may be selected; chart axes
reject string and boolean values. Dashboard reads use the visible device/gateway
chain. Boolean readings are returned as latest values and chronological history;
the frontend renders that history as a 0/1 connection diagram where 1 means
connected and 0 means disconnected.

## Consequences

- Operators can change dashboard composition through database-backed management
  forms.
- A device selector determines the applicable tab set.
- Raw events remain immutable and aggregation is read-only.
- Formula builders, arbitrary aggregations, and URL-routed dashboards remain
  out of scope.
