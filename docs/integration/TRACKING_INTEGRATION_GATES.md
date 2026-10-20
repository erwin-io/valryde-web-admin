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
