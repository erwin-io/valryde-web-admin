# Integration Documentation

This area will hold the approved API contract matrix and tracking integration gates.

## Current contract sources

- Agent A API source and `docs/OPENAPI_ENDPOINT_TAGS.md` in the read-only `valryde-api` reference repository
- Agent A persistent status for implementation/review state
- Agent B tracking contract proposal and status for unapproved/in-progress dependencies
- Tech Lead-approved issues, decisions, merged contracts, and generated OpenAPI artifacts when available

## Known gates

- Do not invent endpoints for dashboard totals, monitoring views, reports, exports, historical routes, live latest-state, deviations, or component-specific health.
- Do not reproduce effective-route precedence in the client.
- Do not connect the client directly to Traccar or expose Traccar/Pusher secrets.
- Treat Agent B realtime/tracking functionality as unavailable until its REST DTOs, authorization, channel/event scopes, ordering, freshness, and reconciliation behavior are approved.
- Record only approved endpoints and schemas in the future `API_CONTRACT_MATRIX.md`.
