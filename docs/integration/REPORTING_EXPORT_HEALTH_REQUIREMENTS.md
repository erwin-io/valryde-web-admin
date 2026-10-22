# Checklist 67 — Minimum Reporting, Export, and Health Requirements

**State:** `BOUNDED_FRONTEND_SUBSET_IMPLEMENTED`; broader reporting/health remains `BACKEND_CONTRACT_BLOCKED`. No report, audit-read, historical tracking, deviation-event, or component-health API exists on `valryde-api` `main` at `827738c`.

Under `VALRYDE-CODEX-E-INDEPENDENT-CLOSURE-003`, the Admin may filter, print, summarize, and create a client-side CSV from explicitly authorized fields already loaded in the current approved API response. It must not load a broad/private dataset merely for export or present this snapshot as a server report.

## Minimum data contracts

| MVP output | Minimum server data | Currently available | Gap |
|---|---|---|---|
| Operator/fleet summary | operator identity, fleet/group/vehicle counts, status filters, stable pagination or aggregate totals | Account list plus separate unpaginated fleet lists | No operator-domain directory join or aggregate contract (G1); client-wide counting is not a scalable report contract |
| Transit summary | route/direction identity and lifecycle totals | Admin route list with nested directions | Current snapshot implemented with an explicit non-private field allow-list; server history/filtering remains unavailable |
| Online/offline device summary | approved device mapping plus latest reporting/freshness state and timestamps | None in Admin API | Agent B latest-state and G10 mapping-read contracts required |
| Route-deviation report | authorized deviation/re-entry events with route/direction/vehicle, ordering, time window, pagination | None | Agent B compliance/history contract required |
| Basic historical route view | authorized position history, retention/time-zone semantics, pagination/limits | None | Agent B history contract required; raw Traccar history must not be duplicated or exposed directly |
| Audit activity | actor, action, entity, safe metadata, time, paging/filtering | Writes exist internally; no read endpoint | Agent A audit-read contract and privacy review required |
| CSV/PDF export | approved report DTO, stable fields/order, time zone, filters, limits, redaction, generated-at/source metadata | Bounded client CSV of filtered, already-loaded transit rows only | Server-generated, historical, private-domain and cross-domain exports remain blocked |
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

## Implemented client boundary

`/system/reports/transit` uses only `GET /api/admin/transit-routes`, which the route-management UI already loads. Its CSV allow-list is route code/name/status, direction label/endpoints/status, route-line point count, corridor metres, and last-updated time. Spreadsheet formula prefixes are neutralized. User identity, fleet membership, device mapping, GPS history, tracking, compliance, audit, and health data are neither loaded nor exported.
