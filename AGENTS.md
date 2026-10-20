# VALRYDE — Agent E Admin Web Instructions

**Project:** Valryde — Public Jeepney Route Live Tracking & Monitoring System

**Module owner:** Agent E — Administrative Web Development

**Checklist ownership:** 56–67

**Repository:** `valryde-web-admin`

## 1. Required reading order

Before meaningful work, read:

1. This `AGENTS.md`.
2. The approved VALRYDE Version 1.0 MVP system documentation, when available.
3. The approved 71-item MVP checklist.
4. `handoffs/AGENT_E_ADMIN_WEB_HANDOFF.md`.
5. `docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md`.
6. `docs/agent-status/AGENT_E_STATUS.md`.
7. Current source, manifests, lockfiles, tests, CI, and repository history.
8. Approved backend and tracking contracts that the current work consumes.

If an authoritative reference is unavailable or a required contract is not approved, report the gap. Do not invent requirements, endpoints, DTOs, event names, permissions, or state transitions.

## 2. Workspace and ownership boundaries

- Write application and Agent E documentation only in this repository.
- Treat `../valryde-api` and `../valryde-infra` as read-only references.
- Preserve existing files and Git history. Do not reinitialize Git or replace a configured remote.
- Agent A owns application auth, RBAC, domain APIs, and PostgreSQL/PostGIS business contracts.
- Agent B owns Traccar, the Tracking Bridge, latest-state/realtime, and route-compliance integration.
- Agent F owns GPS installation/configuration/verification runbooks.
- Shared API, schema, realtime, geospatial, and role changes require Tech Lead-controlled change management.

## 3. Product and technology baseline

Build Valryde Admin with Angular, TypeScript, Angular Material, Angular CDK, custom SCSS, and MapLibre for map administration. Prefer standard Material components and focused feature areas over additional UI frameworks.

The application is an operational administration console, not a ride-hailing, booking, payment, revenue-analytics, or advanced-dispatch product. Do not add those features without approved scope change.

Preserve these architecture rules:

- Dedicated GPS hardware is the vehicle location source.
- Traccar owns raw telemetry and history.
- PostgreSQL/PostGIS owns business entities, canonical route geometry, approvals, mappings, compliance events, audit records, and the latest vehicle state.
- Clients use approved REST contracts plus Pusher reconciliation; they never receive Traccar credentials or server secrets.
- Map rendering uses MapLibre and OpenFreeMap.
- Admin controls official route geometry, direction, route color, and corridor settings.
- Route-compliance thresholds, availability rules, GPS workflow states, and RBAC semantics are shared contracts and must not be recreated or silently changed in the client.

## 4. Information architecture

Use an organized, collapsible Angular Material navigation drawer with these functional groups:

- Dashboard
- Transit Network — routes, directions, and geometry
- Fleet Management — operators, drivers, jeepneys, groups, and assignments
- Applications & Approvals — vehicle applications and GPS setup/installation reviews
- Tracking Operations — GPS mapping/status, global live map, and deviations
- Identity & Access — commuter monitoring and authorized account administration
- System Administration — reports, exports, and component-specific health

Do not add a formal stop registry unless product scope and backend contracts explicitly authorize it.

## 5. UI and implementation rules

- Use simple page structure, clear headings, dedicated record details, structured forms, and contextual links.
- Use searchable, filterable, paginated tables where list contracts support them.
- Provide explicit loading, empty, error, retry, unauthorized, and stale-data states.
- Use meaningful status badges without relying on color alone.
- Keep modules/components single-purpose and avoid oversized decorative cards, gradients, decorative charts, and deeply nested menus.
- Keep request transitions explicit and auditable.
- Reject malformed or non-LineString route geometry with actionable errors.
- Constrain the global tracking map to approved Philippines bounds once the contract and configuration are available.

## 6. Development and verification workflow

Work from `main` on focused feature/fix/documentation branches. Before implementation, identify checklist IDs, contracts, permissions, dependencies, acceptance criteria, and tests. Keep changes scoped and reviewable.

For implementation work, run the applicable lint, typecheck, unit/integration tests, Playwright tests, and production build. Record only commands that actually ran and their real outcomes. Do not claim hardware, provider, or deployed-environment verification without evidence.

Never commit secrets, `.env` files, access tokens, database URLs containing credentials, Traccar credentials, Pusher secrets, OAuth secrets, SIM credentials, or private customer/GPS data.

Developer agents do not self-merge. Tech Lead review decisions are `ACCEPTED`, `CHANGES REQUIRED`, or `OPERATOR-GATED`; do not assign those decisions to your own work.

## 7. Mandatory reporting

Maintain the single canonical Agent E report at `docs/agent-status/AGENT_E_STATUS.md` exactly as required by `docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md`. Update its current snapshot and prepend meaningful activity entries without deleting history.

Every completion report must state checklist IDs, work completed, files changed, actual verification, implementation progress, blockers/dependencies, Git/PR state, status-file location, and next action.
