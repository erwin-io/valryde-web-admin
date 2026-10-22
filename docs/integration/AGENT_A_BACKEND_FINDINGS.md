# Agent A Backend Findings — G10, G11, and D3

**Observed contract baseline:** `valryde-api` `main` at `827738c0f2c33ad3082f6a4a38a8e35669d4b0ea`.

These are reproducible backend contract findings for Agent A. Agent E has not patched the backend.

## G10 — Device mapping cannot be read, updated, or removed

### Evidence

The Admin API exposes only `POST /api/admin/gps-setup-requests/{requestId}/device-mapping`. Its response contains the mapping once. There is no GET, PATCH, or DELETE mapping operation in the registered vehicle-workflow routes.

### Reproduction

1. In an isolated development database, create/seed an eligible GPS setup request in `SCHEDULED` or `INSTALLED` state.
2. Authenticate as `ADMIN`.
3. POST a unique test IMEI, serial number, and Traccar unique ID to the mapping endpoint; observe `201` and the mapping DTO.
4. Reload the GPS request with `GET /api/gps-setup-requests`; observe that the request DTO contains no mapping.
5. Inspect the OpenAPI/registered routes or attempt the intuitive GET/PATCH/DELETE mapping paths; no supported operation exists.
6. If the mapping is wrong, the Admin cannot inspect or correct it through the API.

### Needed decision

Define Admin-authorized mapping read and correction/removal semantics, including audit, uniqueness, active-device safety, and whether corrections are forbidden after verified activation.

## G11 — Route assignments cannot be read for change-impact warnings

### Evidence

The API exposes OPERATOR-only `POST /api/route-assignments` and per-jeepney `GET /api/jeepneys/{jeepneyId}/effective-route`. It exposes no Admin query by route/direction, vehicle, or group that returns assignments.

### Reproduction

1. In an isolated development database, create a route direction and assign it to a test jeepney or fleet group.
2. Authenticate as `ADMIN` and load `GET /api/admin/transit-routes`; observe route/direction data but no assignment counts or IDs.
3. Attempt to determine all affected vehicles before changing/deactivating the direction using documented Admin endpoints.
4. Observe that this requires enumerating every jeepney and calling the effective-route endpoint individually, still without complete direct/group assignment records or a stable impact snapshot.

### Needed decision

Provide an Admin-authorized assignment/impact query or explicitly approve a generic warning with no affected-record enumeration. Define pagination, active-at semantics, direct/group source, and conflict representation.

## D3 — Duplicate direction label update becomes an internal error

### Preconditions

- One route with two directions under the same `routeId`, labels `Outbound` and `Inbound`.
- An authenticated Admin access token.

### Reproduction

```http
PATCH /api/admin/route-directions/{inboundDirectionId}
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{"directionLabel":"Outbound"}
```

### Expected

`409 CONFLICT` with the standard error envelope, consistent with duplicate-label handling during direction creation.

### Actual

The database unique constraint on `(route_id, direction_label)` is raised during update without the create-path conflict mapping, producing `500 INTERNAL_ERROR`.

### Client containment

The current Admin direction form blocks a label already present in the loaded route before sending. This reduces ordinary exposure but is not authoritative and cannot prevent concurrent updates; the backend still needs explicit conflict handling and a regression test.

