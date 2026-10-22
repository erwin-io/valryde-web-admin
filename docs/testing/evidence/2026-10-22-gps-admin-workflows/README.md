# Evidence — Vehicle application review and GPS installation workflow (IDs 63, 64, 56 dashboard)

2026-10-22. Screenshots were not possible: the desktop app window was hidden, so the browser pane could not render. Flows were driven in the browser by script against a throwaway local stub on port 3100 (synthetic data, not committed) and checked by DOM assertions. A dev-server proxy check (`/api/health` → stub 404) confirmed that no request reached the real API. **Not evidence of real backend integration.**

| Flow | Observed |
|---|---|
| Dashboard "Needs attention" | `1 Vehicle applications awaiting review → /applications/vehicles?filter=PENDING`; `1 Installations awaiting completion or verification → /applications/gps?filter=ACTION`; zero counts for the other two |
| Application review | Applicant "Omar Operator" and jeepney "DEF 5678" links shown; Approve → confirmation "DEF 5678 will be marked Approved…" → status re-read as Approved, reviewer "Ada Admin", decision form removed |
| GPS device mapping | Scheduled request → mapping confirmed → "Device mapped" card with IMEI/serial/Traccar ID and "Shown for this visit only" note |
| Mark installed | Confirmed → status re-read as Installed, verification form shown |
| Verification | Four checks → confirmation "All four checks pass. GHI 9012 will be activated" → Verified, recorded checks listed, form removed, snackbar "Installation verified." |

Duplicate-IMEI `409 DEVICE_MAPPING_CONFLICT` handling is covered by unit tests; its live-stub run output was lost to a script error (the script, not the app).

Real local API (`valryde-api` running from Agent A's checkout at `711f4c4`, observed on port 3000; not started by Agent E), unauthenticated read-only probes: `GET /api/health` → 200 `{"status":"ok","database":"ok"}`; `GET /api/admin/users/`, `PATCH /api/admin/users/{id}/status`, `GET /api/admin/transit-routes`, `POST /api/admin/gps-setup-requests/{id}/device-mapping` → 401 `AUTH_REQUIRED`. No credentials used, nothing written.
