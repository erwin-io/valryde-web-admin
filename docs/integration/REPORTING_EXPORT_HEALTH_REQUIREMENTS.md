# Checklist 67 — Minimum Reporting, Export, and Health Requirements

**State:** `BACKEND_CONTRACT_BLOCKED`. No report, export, audit-read, historical tracking, deviation-event, or component-health API exists on `valryde-api` `main` at `827738c`.

## Minimum data contracts

| MVP output | Minimum server data | Currently available | Gap |
|---|---|---|---|
| Operator/fleet summary | operator identity, fleet/group/vehicle counts, status filters, stable pagination or aggregate totals | Account list plus separate unpaginated fleet lists | No operator-domain directory join or aggregate contract (G1); client-wide counting is not a scalable report contract |
| Transit summary | route/direction identity and lifecycle totals | Admin route list with nested directions | Snapshot can be displayed, but export fields, volume, privacy, and server filtering are unapproved |
| Online/offline device summary | approved device mapping plus latest reporting/freshness state and timestamps | None in Admin API | Agent B latest-state and G10 mapping-read contracts required |
| Route-deviation report | authorized deviation/re-entry events with route/direction/vehicle, ordering, time window, pagination | None | Agent B compliance/history contract required |
| Basic historical route view | authorized position history, retention/time-zone semantics, pagination/limits | None | Agent B history contract required; raw Traccar history must not be duplicated or exposed directly |
| Audit activity | actor, action, entity, safe metadata, time, paging/filtering | Writes exist internally; no read endpoint | Agent A audit-read contract and privacy review required |
| CSV/PDF export | approved report DTO, stable fields/order, time zone, filters, limits, redaction, generated-at/source metadata | None | Product/API export contract required; do not export arbitrary UI tables as the MVP report |
| System health | separate API, app DB, Traccar, Tracking Bridge, and device-reporting states with checked-at and safe diagnostics | `GET /api/health` reports API/app DB only | Agent A/B component-health aggregation required |

## Existing endpoint boundary

`GET /api/health` may support a narrowly labeled “Valryde API and application database” check. It must not be presented as Traccar, Tracking Bridge, realtime, GPS-device, or whole-system health.

## Required behavior before implementation

- Server-authoritative RBAC and data isolation.
- Explicit date/time-zone and inclusive/exclusive range semantics.
- Pagination/row limits for report and history queries.
- Stable export field set, labels, ordering, encoding, file naming, and redaction rules.
- Source/checked-at timestamps so stale data is not presented as current.
- Component health states that distinguish unavailable, degraded, stale, and unknown.
- Acceptance fixtures for totals and export contents.

Until these are approved, System Administration must not show fabricated metrics, placeholder history, synthetic compliance events, or combined “all healthy” status.
