# Admin Independent UI Batch — Contract Inventory

**Verified source:** `valryde-api` `main` `827738c` (2026-10-22). Route files: `src/routes/{admin-user,auth,fleet,transit,vehicle-workflow}-routes.ts`; services: `transit-service.ts`, `vehicle-workflow-service.ts`; migrations `002`, `005`. Agent A fixture PR #15 is open at `be8d6d0` but not merged. No reporting, export, audit-read, settings, directory (G1), membership (G2) or assignment-read endpoints exist on `main`.

All operations below are protected by `fastify.requireRoles(...)`, which first authenticates (`401 AUTH_REQUIRED` / `401 SESSION_REVOKED`), then checks the role (`403 FORBIDDEN`). Errors use `{ error: { code, message, requestId, details? } }`.

## 1. Transit (ID 61 implemented in PR #5; ID 62 proposal below)

| Operation | Role | Body / rules | Errors |
|---|---|---|---|
| `GET /admin/transit-routes` | ADMIN | All statuses, nested directions with GeoJSON geometry | 401, 403 |
| `POST /admin/transit-routes` | ADMIN | `routeCode` 1–32 (citext unique), `publicName` 1–160, `description?` ≤ 2000, `routeColorHex` `#RRGGBB`; created `DRAFT` | 400, 409 `CONFLICT` (duplicate code) |
| `PATCH /admin/transit-routes/{routeId}` | ADMIN | ≥ 1 of `publicName`, `description` (nullable), `routeColorHex`, `status`; **route code immutable** | 400, 404 |
| `POST /admin/transit-routes/{routeId}/directions` | ADMIN | `directionLabel` 1–120 (unique per route), `originName`, `destinationName` 1–160, **`geometry` LineString required** (2–10,000 WGS84 positions), `corridorM?` 1–5000 (default 100) | 400, 404, 409 `CONFLICT` |
| `PATCH /admin/route-directions/{directionId}` | ADMIN | ≥ 1 of label, origin, destination, `geometry`, `corridorM`, `status` | 400, 404; **duplicate label → 500 (D3)** |

Status values: `DRAFT | ACTIVE | INACTIVE | ARCHIVED`. **No lifecycle rules are enforced**: any status can change to any other. Commuter list (`GET /transit-routes`) shows `ACTIVE` routes that have ≥ 1 `ACTIVE` direction. No delete; no read of route assignments; route assignment (`POST /route-assignments`) is OPERATOR-only.

## 2. Vehicle applications and GPS setup (IDs 63–64 implemented in PR #6)

| Operation | Role | Rules | Errors |
|---|---|---|---|
| `GET /vehicle-applications` | DRIVER, OPERATOR, ADMIN | Admin sees all | 401, 403 |
| `PATCH /admin/vehicle-applications/{id}/review` | ADMIN | `decision: APPROVED \| REJECTED`, `reviewNotes?` ≤ 2000; only `PENDING`; updates jeepney status | 400, 404, 409 `CONFLICT` |
| `GET /gps-setup-requests` | DRIVER, OPERATOR, ADMIN | Admin sees all | 401, 403 |
| `PATCH /admin/gps-setup-requests/{id}/status` | ADMIN | `PENDING→APPROVED\|REJECTED`, `APPROVED→SCHEDULED\|REJECTED`, `SCHEDULED→INSTALLED\|REJECTED`; `scheduledAt` required for `SCHEDULED`; `rejectedReason` 1–2000 required for `REJECTED`; `INSTALLED` sets verification `PENDING` | 400, 404, 409 `CONFLICT` (invalid transition) |
| `POST /admin/gps-setup-requests/{id}/device-mapping` | ADMIN | Request `SCHEDULED` or `INSTALLED`; `imei` `^[0-9]{14,17}$`, `serialNumber` 1–128, `traccarUniqueId` 1–128 (non-secret); unique IMEI, serial, Traccar ID, jeepney, request | 400, 404, 409 `CONFLICT` (not scheduled), 409 `DEVICE_MAPPING_CONFLICT` |
| `POST /admin/gps-setup-requests/{id}/verification` | ADMIN | `powerOk`, `simOk`, `serverOk`, `gpsFixOk`, `notes?`; requires `INSTALLED` + mapping; all four true → `VERIFIED` and jeepney `ACTIVE`, else `FAILED` (repeatable) | 400, 404, 409 `GPS_NOT_INSTALLED` |

Submission (`POST /vehicle-applications`, `POST /gps-setup-requests`) is DRIVER/OPERATOR-only and not part of Admin web. Request-correction does not exist.

## 3. Findings for Agent A (reported, not changed)

| ID | Finding | Client handling |
|---|---|---|
| D3 | `PATCH /admin/route-directions/{id}` renaming to a label already used on the route violates `UNIQUE (route_id, direction_label)` without a handler → `500 INTERNAL_ERROR` (create maps the same case to `409`). | Direction form blocks duplicate labels before sending. |
| G10 | No read endpoint for device mappings and no unmap. An Admin cannot see an existing mapping, and a mistaken mapping cannot be corrected through the API. | Mapping shown once from the create response; confirmation warns it cannot be changed; gated note on the page. |
| G11 | No read endpoint for route assignments. Deactivating a route cannot warn about assigned vehicles. | Confirmation copy states only verified commuter-visibility effects. |
| — | Transit statuses have no transition rules (any → any). | All statuses offered; every status change confirmed. |
| — | Unknown body properties are stripped (AJV `removeAdditional`) rather than rejected despite `additionalProperties: false` (confirmed earlier for the user-status route). | No impact; the client sends only documented fields. |

## 4. Package status

| Package | Checklist | Result |
|---|---|---|
| E1 Admin auth and User Accounts acceptance | 56, 59 | **BACKEND_FIXTURE_BLOCKED** until Agent A fixture PR #15 merges. Fixtures are not on `main` `827738c`; owner-created accounts are not required. A local `valryde-api` was previously observed running (not started by Agent E); unauthenticated read-only probes only: health `200`, protected Admin endpoints `401 AUTH_REQUIRED`. Procedure: `docs/testing/REAL_API_INTEGRATION_PROCEDURE.md`. Refresh-token storage, cookie contract, CSP and Angular major unchanged. |
| E2 Official routes and directions | 61 | PR #5 **merged** at `8018e88`. Direction *creation* deferred to ID 62 because it requires geometry. |
| E3 Applications and GPS workflow | 63, 64 (+56 dashboard counts) | PR #6 open, reconciled with `main` `8018e88` at `cc14c9c`. Physical connectivity and GPS fix remain hardware/operator gates. |
| E4 Reports / export | 67 | **BACKEND_CONTRACT_BLOCKED.** No reporting, export, audit-read or component-health endpoint exists; only `GET /api/health` (API + DB). Client-side CSV of list payloads was not built: no approved export scope, field set or privacy review. See `REPORTING_EXPORT_HEALTH_REQUIREMENTS.md`. |
| ID 62 Geometry | 62 | **Proposal only** (section 5). No geometry editor implemented. |

## 5. ID 62 — geometry contract inventory and UI proposal (for review, not implemented)

**Available contract:** direction create (`geometry` required) and update (`geometry`, `corridorM` optional) as in section 1. Geometry is a GeoJSON `LineString` `[longitude, latitude]`, 2–10,000 positions, server-validated (finite, WGS84 bounds) and stored as PostGIS SRID 4326. `corridorM` 1–5000. **Not available:** stops, geofences beyond the per-direction corridor, assignment-impact data (G11), geometry history or undo.

The bounded contract and safety review is maintained in `GEOMETRY_EDITOR_CONTRACT_REVIEW.md`.

**Proposed UI (separate PR, after Tech Lead approval):**

1. `/transit/routes/:routeId/directions/new` and `/transit/directions/:directionId/geometry`: full-width MapLibre workspace with a configurable OpenFreeMap style, initial view constrained to approved Philippines bounds.
2. Draft model kept locally: draw or extend a polyline by clicking; drag and delete vertices; GeoJSON file import (must contain exactly one `LineString`; `MultiLineString`, `Polygon` or `FeatureCollection` with more than one line rejected with an actionable message); corridor width input rendered as a buffer preview.
3. Client validation mirrors the server: 2–10,000 positions, finite numbers, longitude −180…180, latitude −90…90, plus warnings for positions outside the Philippines bounds and duplicate consecutive points.
4. Save sends only `geometry` and/or `corridorM` (plus metadata on create); confirmation for `ACTIVE` directions ("commuters see the new line immediately"); dirty-guard and discard; `409` / `400` shown with the draft retained.
5. Dependencies to confirm before build: MapLibre ≥ 6.15 (5.x has GHSA-jrc7-96c5-q579), approved Philippines bounds values, OpenFreeMap style URL and attribution, keyboard alternative for vertex editing (accessibility), and whether an active-assignment warning is required (needs G11).
