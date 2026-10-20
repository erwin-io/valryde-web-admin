# Admin Workflows

## W-01 — Admin sign-in and dashboard access

`/sign-in` validates email/password, calls `POST /api/auth/login`, rejects a returned user without `ADMIN`, stores the session through the auth service, and enters `/dashboard`. The guard restores with `GET /api/auth/me`; refresh uses `POST /api/auth/refresh`. Invalid/revoked/disabled sessions clear local state and return to sign-in.

Acceptance: valid Admin enters the shell; invalid credentials are actionable; non-Admin tokens never expose the shell; return URL is honored only for internal routes.

## W-02 — Vehicle registry to details

Open Fleet Management → Vehicles, load `GET /api/jeepneys`, search/filter locally until a paginated API exists, select a row, then compose details from the selected vehicle and `GET /api/jeepneys/{id}/effective-route`. Application/GPS context is joined only from authorized list responses.

## W-03 — Operator to fleet context

Open Operators, filter `GET /api/admin/users/` to `OPERATOR`, select an account, and link to filtered groups/vehicles only when their `operatorId` is available. A dedicated operator-domain record endpoint is missing, so the UI must label account data and avoid invented business fields.

## W-04 — Driver to assignments

Open Drivers, filter the Admin user response to `DRIVER`, then show supported identity fields. The current Admin APIs do not expose a complete driver-assignment query; contextual assignment is marked unavailable rather than inferred.

## W-05 — Route to directions and geometry

Open Transit Network → Routes, load `GET /api/admin/transit-routes`, select a route, inspect its directions, then open a direction-specific geometry workspace.

## W-06 — Edit route geometry

Load one direction from the Admin route list, keep an isolated draft, edit/draw/import a GeoJSON LineString, validate type/coordinate count/range and corridor, then PATCH the approved direction endpoint. Canceling a dirty draft requires confirmation. Active-vehicle impact warning remains blocked until assignment-impact data is available.

## W-07 — Review vehicle application

Load the queue, select a `PENDING` application, review its supported fields and related vehicle, choose `APPROVED` or `REJECTED`, optionally add review notes, confirm, and PATCH the Admin review endpoint. Request-correction is not offered because Agent A exposes no such transition.

## W-08 — Inspect GPS installation status

Open an approved application’s GPS request. Offer only state transitions accepted by the server, then separate device mapping and verification forms. Never show service credentials. Surface 409 state conflicts without pretending the action succeeded.

## W-09 — Inspect live vehicle

Hidden from production navigation until Agent B approves snapshot, channel/event, authorization, freshness, ordering, stale/disconnect, and reconciliation contracts. The future flow is REST snapshot → subscribe → merge ordered updates → reconcile after reconnect.

## W-10 — Unauthorized action

Route guards prevent non-Admin shell access. API 401 clears an invalid session and returns to sign-in; API 403 retains the session and shows a permission-denied state. The UI never treats hidden controls as the security boundary.

## W-11 — Validation or server error

Client validation focuses the first invalid field and supplies a corrective message. Structured API errors preserve `code`, `message`, and `requestId`; the page keeps entered data and provides retry where safe. Unknown errors use a generic message with the request ID when available.
