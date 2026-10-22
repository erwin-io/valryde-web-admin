# Checklist 62 — Geometry Editor Contract Review

**Review baseline:** `valryde-api` `main` at `827738c0f2c33ad3082f6a4a38a8e35669d4b0ea` on 2026-10-22. This is a bounded frontend contract review, not implementation approval for stops, arbitrary geofences, geometry history, or tracking behavior.

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

## Remaining approval inputs

- Exact Philippines camera bounds.
- Approved OpenFreeMap-compatible style URL and attribution.
- MapLibre version at least 6.15 and dependency review.
- Accessible keyboard alternative for vertex operations.
- Tech Lead decision on whether generic active-route warning is sufficient while G11 remains open.
