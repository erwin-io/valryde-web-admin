# API Contract Matrix

**Verified source:** merged Agent A `main` at `711f4c45967e192be155e05e72714b99645ecc7d` on 2026-10-21. Base path is `/api`. Every protected operation uses a bearer access token. Standard errors are `{ error: { code, message, requestId, details? } }`.

## Auth and identity

| Method/path | Role | Request | Success envelope | Admin use |
|---|---|---|---|---|
| `POST /auth/login` | Public | `{email,password}`; password 12–128 chars | tokens, expiries, `user` | Sign in; client additionally requires `ADMIN` |
| `POST /auth/refresh` | Public | `{refreshToken}` | rotated tokens and `user` | Session renewal |
| `POST /auth/logout` | Public | `{refreshToken}` | 204 | Revoke session |
| `GET /auth/me` | Any active role | — | `{user}` | Restore/verify session |
| `GET /admin/users/` | ADMIN | — | `{users: PublicUser[]}` | First management module |
| `PATCH /admin/users/{userId}/status` | ADMIN | `{status: ACTIVE|DISABLED}` | `{user}` | Status only; self-disable is 400 |

`PublicUser` contains `id`, `email`, `displayName`, `status`, `emailVerified`, `roles`, `createdAt`, and `updatedAt`. No create-Admin, role-mutation, delete-user, user-detail, filtering, or pagination endpoint is approved.

## Fleet

| Method/path | Roles | Contract note |
|---|---|---|
| `GET /jeepneys` | DRIVER, OPERATOR, ADMIN | `{jeepneys}`; server-scoped |
| `POST /jeepneys` | DRIVER, OPERATOR, ADMIN | plate/color/description; optional operator ID |
| `PATCH /jeepneys/{id}` | DRIVER, OPERATOR, ADMIN | color/description/status; approval status remains Admin-only server-side |
| `POST /jeepneys/{id}/driver-assignment` | OPERATOR, ADMIN | `{driverId}` |
| `GET /fleet-groups` | DRIVER, OPERATOR, ADMIN | `{groups}`; server-scoped |
| `POST /fleet-groups` | OPERATOR, ADMIN | optional operator ID, name, description |
| `PATCH /fleet-groups/{id}` | OPERATOR, ADMIN | name/description/status |
| `POST /fleet-groups/{id}/drivers` | OPERATOR, ADMIN | `{driverId}` |
| `POST /fleet-groups/{id}/jeepneys` | OPERATOR, ADMIN | `{jeepneyId}`; ambiguity protected |

There are no dedicated operator, driver, jeepney-detail, group-detail, membership-list, or server-pagination endpoints.

## Transit

| Method/path | Role | Contract note |
|---|---|---|
| `GET /admin/transit-routes` | ADMIN | All statuses; `{routes}` with nested directions |
| `POST /admin/transit-routes` | ADMIN | route code/name/optional description/color |
| `PATCH /admin/transit-routes/{id}` | ADMIN | name/description/color/status; route code immutable here |
| `POST /admin/transit-routes/{id}/directions` | ADMIN | label, endpoints, WGS84 LineString, optional corridor |
| `PATCH /admin/route-directions/{id}` | ADMIN | label/endpoints/geometry/corridor/status |
| `GET /jeepneys/{id}/effective-route` | DRIVER, OPERATOR, ADMIN | direct beats one group; null or 409 ambiguity |

Geometry is `{type:'LineString', coordinates:[[longitude,latitude], ...]}` with 2–10,000 points. Corridor is an integer from 1–5,000 m. Route/direction statuses are `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`.

## Applications and GPS

| Method/path | Roles | Contract note |
|---|---|---|
| `GET /vehicle-applications` | DRIVER, OPERATOR, ADMIN | Admin receives all permitted records |
| `PATCH /admin/vehicle-applications/{id}/review` | ADMIN | decision only `APPROVED|REJECTED`; optional notes |
| `GET /gps-setup-requests` | DRIVER, OPERATOR, ADMIN | Admin receives all permitted records |
| `PATCH /admin/gps-setup-requests/{id}/status` | ADMIN | `APPROVED|SCHEDULED|INSTALLED|REJECTED`; conditional schedule/reason |
| `POST /admin/gps-setup-requests/{id}/device-mapping` | ADMIN | IMEI 14–17 digits, serial, non-secret Traccar unique ID |
| `POST /admin/gps-setup-requests/{id}/verification` | ADMIN | power/SIM/server/GPS booleans, optional notes |

Vehicle application statuses are `PENDING|APPROVED|REJECTED`. GPS verification statuses are `NOT_STARTED|PENDING|VERIFIED|FAILED`. Request-correction is not approved.

## Missing contracts

Dashboard aggregates, stops, operator/driver domain details, assignment listings, audit listing, general configuration, report/export, historical route views, component-specific health, latest-state, live map, deviations, and Pusher events are unavailable. Their screens remain blocked, partial, or absent from production navigation.

## Compatibility check — Agent A `main` `4a9a152` (API PR #6 handoff)

Checked 2026-10-21 against `AGENT_A_FRONTEND_API_INTEGRATION_HANDOFF.md` §1, §4.3 and the merged route source. Auth and Admin-user source is unchanged since `711f4c4`.

| Admin client use | Agent A contract | Status |
|---|---|---|
| `POST /auth/login`, reject non-`ADMIN` client-side | §1.1 "Admin web must reject sign-in client-side when ADMIN is absent" | Compatible; client also revokes the issued refresh token |
| `POST /auth/refresh` rotation, serialized | §1.1 "Serialize refresh across concurrent requests" | Compatible (single in-flight refresh) |
| `401 SESSION_REVOKED` → sign out locally | §1.2 | Compatible |
| `POST /auth/logout`, clear locally regardless of result | §1.1 | Compatible |
| `GET /admin/users/` unpaginated, filter client-side | §4.3 class 2 | Compatible; trailing-slash path verified by `inject()` |
| `PATCH /admin/users/{id}/status`, self-disable `400` | §4.3 class 1 | Compatible; RBAC verified (`docs/security/ADMIN_AUTH_AND_DEPENDENCY_REVIEW.md` §2) |
| User detail composed from list | §4.3 class 2 | Compatible |
| Role change, Admin creation, deletion, server search | §4.3 class 4/6 | Not implemented (correct) |
| Error envelope, branch on `code`, show `requestId` | §1 rule 3 | Compatible |
| Rate limit as `500` + `retry-after` (defect D1) | §1.3 | Handled in sign-in copy |
| Restore = refresh then `GET /auth/me` | §1.1 | Client uses the `user` returned by refresh; `GET /auth/me` not needed for the same data |

## Checklist 60 consumption — Agent A `main` `827738c`

| Endpoint | Fields used | Not available (shown as gated or omitted) |
|---|---|---|
| `GET /jeepneys` | `id`, `plateNo`, `colorHex`, `description`, `status` (6 values), `approvedAt`, `operatorId` (shown as an opaque operator record ID), `createdAt`, `updatedAt` | Operator name (G1), active driver (G3), group membership (G2), GPS/application status (IDs 63–64 modules), location/online/compliance (Agent B) |
| `GET /fleet-groups` | `id`, `name`, `description`, `status`, `operatorId` (opaque), `createdAt`, `updatedAt` | Members, member counts, group route assignment (no read endpoint) |
| `GET /jeepneys/{id}/effective-route` | `source`, `groupId` (only jeepney→group link the API returns), `activeFrom`, `direction.directionLabel/originName/destinationName`; `null` → no route; `409 ROUTE_ASSIGNMENT_CONFLICT` → conflict notice | Route geometry is fetched but not rendered (map arrives with IDs 61–62) |
