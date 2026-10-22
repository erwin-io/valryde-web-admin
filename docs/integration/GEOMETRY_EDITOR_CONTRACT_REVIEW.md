# Checklist 62 — Geometry Editor Contract Review

**Review baseline:** `valryde-api` `main` at `827738c0f2c33ad3082f6a4a38a8e35669d4b0ea` on 2026-10-22. The bounded existing-direction foundation is implemented under `VALRYDE-CODEX-E-INDEPENDENT-CLOSURE-003`; this is not approval for stops, arbitrary geofences, geometry history, corridor persistence, or tracking behavior.

## Authoritative model

- A route direction owns one GeoJSON `LineString` and one integer `corridorM`.
- Coordinates are GeoJSON order `[longitude, latitude]`, not latitude/longitude.
- Geometry contains 2–10,000 positions. Values must be finite; longitude is −180…180 and latitude is −90…90.
- PostgreSQL stores the line as PostGIS `geometry(LineString, 4326)`. SRID 4326 is WGS84 longitude/latitude.
- Corridor is 1–5,000 metres and defaults to 100 metres on direction creation.
- Canonical geometry remains server-owned after a successful Admin mutation.

## Available Admin mutations

| Operation | Supported geometry behavior |
|---|---|
| `POST /api/admin/transit-routes/{routeId}/directions` | Creates direction metadata, required `geometry`, and optional `corridorM` |
| `PATCH /api/admin/route-directions/{directionId}` | Updates `geometry` and/or `corridorM`; may also update metadata/status |

There is no separate geometry-persistence endpoint. The editor must call only these approved direction operations. Existing directions are read from nested results returned by `GET /api/admin/transit-routes`.

## Safe editor boundary

The approved bounded editor may:

1. Edit exactly one direction draft at a time.
2. Draw, move, append, and delete vertices while retaining the unsaved draft after validation/server errors.
3. Import one unambiguous GeoJSON LineString and reject unsupported geometry types or ambiguous collections.
4. Validate the server limits before submission and retain server-side validation as authoritative.
5. Preview corridor width without claiming the preview is a stored geofence.
6. Confirm saves to an `ACTIVE` direction with accurate commuter-visibility copy.
7. Protect dirty drafts with explicit discard confirmation.

The editor must not:

- Create or persist stop records; no stop contract exists.
- Create polygons or standalone geofences; only the per-direction corridor exists.
- Reimplement effective-route or assignment precedence.
- Claim assignment-impact analysis. G11 blocks identifying affected vehicles/groups.
- Claim history, undo across saved versions, topology repair, snapping authority, or multi-route optimization.
- call Traccar or modify Agent B compliance data directly.

## Published routes and assignments

An `ACTIVE` direction can be patched by the current backend. The client can warn that commuter-visible canonical geometry changes immediately, but cannot truthfully enumerate affected assignments because there is no route-assignment read endpoint. If the Tech Lead requires assignment-specific impact confirmation, G11 must be resolved before that UI is enabled.

## Agent B boundary

Agent B consumes canonical route direction/corridor data for tracking compliance. The editor changes only Agent A's canonical direction contract. OFF_ROUTE/re-entry rules, latest-state processing, compliance events, Pusher payloads, and tracker data remain Agent B-owned and are not recalculated or previewed by the editor.

## Implemented decisions

- MapLibre 6.15.0 is lazy-loaded with the geometry page; its worker is served as a same-origin build asset.
- The initial style is an empty local style, so no coordinate or usage data is transmitted to a tile provider before a style/attribution policy is approved.
- **E8-02 (2026-10-23):** because that style has no geographic content, the surface is labelled a *geometry canvas without road or geographic context*. Vertices cannot be road-aligned visually; accurate placement relies on surveyed coordinates entered manually or imported as GeoJSON.
- Mouse users can click and drag vertices. The keyboard-accessible alternative provides previous/next selection, exact longitude/latitude inputs, four-direction nudge buttons, and removal.
- Save is enabled only for a valid, dirty draft of an existing direction and uses `PATCH /api/admin/route-directions/{directionId}` with a `geometry`-only body.
- **E8-01 (2026-10-23):** one Save at a time. The draft is locked from the moment Save starts (including the confirmation dialog) until the request settles; every edit path (map click, vertex drag, nudge, coordinate apply, remove, undo, redo, reset, GeoJSON import) is refused while locked. The submitted geometry is captured once; a response replaces the draft only if the draft still equals that snapshot, otherwise newer edits are kept and only the saved baseline updates. Failures keep the draft; destroying the page cancels the request.
- An Active route/direction receives a generic visibility warning. The warning explicitly says assignment-specific impact is unavailable.

## Remaining approval inputs

- Exact Philippines camera bounds.
- Approved external basemap style URL, tile-provider privacy terms, hosting CSP and attribution.
- Tech Lead acceptance of the generic active-route warning while G11 remains open.
- Separate corridor persistence, direction-creation, and assignment-impact product decisions.

## Rapid-delivery update — API origin/main 810c8a1

The current directive VALRYDE-E-RAPID-DELIVERY-003 authorizes corridor persistence and assignment-impact adoption. Prior gate statements below describe the historical foundation.

- Edit corridor in direction details: integer 1–5,000 metres; unchanged fields are omitted from PATCH.
- Before every geometry/corridor save, `GET /api/admin/route-directions/{id}/assignment-impact?page=1&pageSize=20` supplies total affected jeepneys and direct/group assignment counts. Totals come from the server and are not inferred from the bounded page. The confirmation identifies this as a current snapshot, not a transaction lock.
- A denied, conflicting or failed preview prevents saving and retains the draft. Confirmation cancellation and component destruction release edit locks; duplicate submits are rejected.
- D3 concurrent rename conflicts return `409 CONFLICT` and are shown at the name field with request ID; local uniqueness validation remains a convenience.
- No standalone geofence read/write contract exists. Map style/bounds remain unchanged; no provider, tracking threshold, geometry authority or backend change.
