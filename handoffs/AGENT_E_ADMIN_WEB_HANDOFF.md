# VALRYDE — Agent E Admin Web Handoff

**Agent:** E — Administrative Web Development

**Checklist IDs:** 56–67

**Repository:** `valryde-web-admin`

**Status:** Development authorized; shell, Admin access control and User Accounts (56, 59) implemented — see `docs/agent-status/AGENT_E_STATUS.md` for current state

## Mission

Build Valryde Admin as the service-provider operational console and canonical route/GPS administration UI using Angular, Angular Material, Angular CDK, TypeScript, custom SCSS, and MapLibre/OpenFreeMap.

The canonical approved Agent E scope originates from the backend reference handoff `valryde-api/handoffs/E_Admin_Web_Application_Agent_Handoff.md`. This local handoff records the repository-specific execution boundaries; it does not replace approved system documentation or Tech Lead decisions.

## Checklist ownership

| ID | Feature | Priority | Bootstrap state |
|---:|---|---|---|
| 56 | Admin Login & Dashboard | High | NOT_STARTED |
| 57 | Operator Management | High | NOT_STARTED |
| 58 | Driver Monitoring | Medium | NOT_STARTED |
| 59 | Commuter User Monitoring | Medium | NOT_STARTED |
| 60 | Jeepney & Fleet Group Monitoring | High | NOT_STARTED |
| 61 | Official Transit Route & Direction Management | High | NOT_STARTED |
| 62 | Route Polyline / Corridor / Geofence Management | High | NOT_STARTED |
| 63 | GPS Device Management & Mapping | High | NOT_STARTED |
| 64 | GPS Setup Request Approval & Installation Status | High | NOT_STARTED |
| 65 | Global Live Tracking Map | High | NOT_STARTED |
| 66 | Route Deviation Monitoring | High | NOT_STARTED |
| 67 | Basic Reports, Export & System Health | Medium | NOT_STARTED |

## Navigation scope

- **Dashboard:** operational summary only; avoid decorative analytics.
- **Transit Network:** route and direction records, route color, LineString/GeoJSON geometry, corridor, and approved geofences.
- **Fleet Management:** operators, drivers, jeepneys, groups, and assignments.
- **Applications & Approvals:** vehicle applications and GPS setup/installation review.
- **Tracking Operations:** device status/mapping, Philippines-bounded global map, current deviations, and approved event/history views.
- **Identity & Access:** commuter monitoring and authorized account-state administration.
- **System Administration:** basic reports, CSV/PDF export, and separately identified API/app database/Traccar/Tracking Bridge/device health.

A formal stop registry is not currently authorized. Booking, fare/payment, revenue analytics, anonymous share links, advanced dispatch, and other Phase 2 concepts are excluded.

## Approved integration facts

- Authentication is server-controlled and includes `ADMIN` role enforcement. Revoked/invalid sessions must be denied.
- The API currently documents Admin user listing/status, fleet/group records, canonical route/direction administration, route assignment resolution, vehicle-application review, and GPS workflow/mapping/verification operations.
- The public transit list uses a pagination envelope; do not assume a bare array.
- Effective route precedence is server-owned: direct jeepney assignment wins, otherwise exactly one active group assignment may be inherited; ambiguity is `409 ROUTE_ASSIGNMENT_CONFLICT`.
- Route geometry uses WGS84 GeoJSON LineString semantics. Admin remains authoritative for route color and corridor.
- GPS request states include `PENDING`, `APPROVED`, `SCHEDULED`, `INSTALLED`, and `REJECTED`, plus verification/mapping state.
- Raw Traccar telemetry and credentials stay outside the web client.
- Live tracking must eventually use approved latest-state REST plus Pusher reconciliation. Agent B's tracking/latest-state/realtime contract is not yet an implementation dependency that Agent E may invent.
- Reporting, historical tracking, exports, and component-specific health require approved contracts where the current API has no corresponding operation.

## Implementation sequence

1. Scaffold Angular workspace and quality gates only after the full development directive.
2. Implement the Material application shell, Admin authentication, and dashboard.
3. Add account/fleet monitoring.
4. Add transit CRUD and MapLibre route geometry tooling.
5. Add vehicle/GPS applications, approvals, and device mapping.
6. Integrate approved live-state/realtime/deviation contracts.
7. Add reports, export, health, and acceptance coverage as contracts become available.

## Delivery rules

- Work on focused branches from `main`; do not self-merge.
- Reference stable checklist IDs and GitHub issues in implementation PRs.
- Keep API DTOs, endpoint paths, RBAC, realtime names/scopes, route thresholds, and GPS state transitions aligned with approved contracts.
- Test valid, validation, unauthorized, loading, empty, error, retry, stale, and reconnect behavior as applicable.
- Record actual evidence in `docs/agent-status/AGENT_E_STATUS.md` under the shared policy.

## Current gates

- The full approved Version 1.0 baseline DOCX and standalone 71-item checklist were not found in the inspected repositories; the canonical handoffs contain the reconciled Agent E checklist.
- Agent A contracts are implemented on a feature branch/PR and were not represented as Tech Lead-accepted in the inspected status.
- Agent B latest-state, route-compliance, realtime, and tracking contracts remain in progress or proposed.
- Real Admin credentials, live external providers, and physical GPS/Traccar verification are owner/operator gates.
