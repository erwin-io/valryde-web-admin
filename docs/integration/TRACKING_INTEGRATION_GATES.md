# Tracking Integration Gates

Tracking Operations remains absent from production navigation until Agent B and the Tech Lead approve all required contracts.

## Required before implementation

- Authorized Admin REST snapshot endpoint and exact latest-state DTO.
- Pusher channel naming, authorization endpoint, event names, and payload schemas.
- Ordering/version rules, mapping generation, and duplicate/out-of-order handling.
- Freshness/staleness thresholds and clock/future-tolerance behavior.
- Reconnect strategy and REST reconciliation semantics.
- Route-compliance status/event DTOs and history pagination/time-window rules.
- Explicit privacy fields and proof that no Traccar/service secret reaches the browser.
- Component-specific health contract for API/app DB, Traccar, Tracking Bridge, and device reporting.

## Prepared frontend boundary

Future code may depend on a `TrackingGateway` interface with snapshot, event stream, reconciliation, and connection-state methods. Any mock must live in an isolated development/test provider, be visibly labeled synthetic, and never be enabled in production builds.

## Acceptance gates

- Authorized global snapshot loads within Philippines map bounds.
- Newer ordered events update the correct vehicle; stale/duplicate events do not regress state.
- Disconnect/stale states are visible and never fabricate positions.
- Reconnect performs REST reconciliation before declaring data current.
- Route deviations and re-entry events use server-owned route/compliance semantics.
- 401/403 and cross-scope data attempts are handled safely.
- No credentials, raw provider response, or unapproved telemetry history is exposed.

## Rapid-delivery preparation — IDs 65 and 66

`VALRYDE-E-RAPID-DELIVERY-003` authorizes adapter-driven screens against proposed B contracts. The implementation references B design `149cefc82d0ccea3c1efe06aebaf157a607c1d8e`, `docs/design/stage13b/GATEWAY_CONTRACT_PROPOSAL.md`, while API main `810c8a1` explicitly says no approved client gateway exists.

`ADMIN_TRACKING_GATEWAY` is an internal UI projection boundary, not a frozen wire DTO. Its production default is null. Guarded routes `/tracking/live` and `/tracking/deviations` show the unavailable state by default and remain absent from the production navigation. No guessed REST paths, direct Traccar connection, Pusher client, demo provider or credential is enabled.

A future released adapter must validate/allowlist the exact wire DTO, enforce Admin audience, supply complete currently authorized snapshots, convert coordinate-free invalidations to refresh requests, coalesce notifications/poll within the approved D11 budget, and report transport connection state. It must not emit coordinates through invalidations. The prepared page cancels superseded requests, reconciles on reconnect, replaces complete collections including removals at equal revision, clears rows/stops retries on 401/403, marks disconnect/expiry UNKNOWN, and renders private last-known coordinates distinctly. It does not calculate route compliance or infer hardware offline from transport loss. Bounds use the G6 Philippines envelope; no external basemap is configured.

Current-deviation rows use server OFF_ROUTE only while a position has a valid unexpired server deadline. Historical compliance/re-entry events require the separate released history/privacy contract. MapLibre cleanup and timer cancellation are implemented; focused component tests disable WebGL and exercise injected test projections. Real gateway, actual Pusher, browser map rendering and hardware evidence remain separate acceptance gates.