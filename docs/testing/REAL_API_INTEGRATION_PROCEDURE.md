# Real API Integration Procedure — Admin web

**Purpose:** repeatable verification of the Admin web (IDs 56, 59 from PR #2; 60; 61 from PR #5; 63–64 from PR #6) against a real local `valryde-api`, replacing the synthetic stubs used so far.
**State:** `AUTHENTICATED_ACCEPTANCE_BLOCKED` as of rapid-delivery verification. Agent A fixtures and G1/G2/G10/G11/D3 are merged on API main `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479`. The remaining gate is a running, isolated, already-seeded local API and temporary fixture credentials; On resume localhost:3000 returned health 200/database ok and five protected surfaces returned unauthenticated 401. Credential environment variables remain absent; no real authenticated tests have passed in this session.
**Never** run this against production, a shared database, or real user records.

## 1. Preconditions (owner/operator)

| Item | Requirement |
|---|---|
| API source | `valryde-api` `main` at or after `4a9a152`, in its own checkout. Agent E does not modify it. |
| Runtime | Node.js ≥ 22.12, PostgreSQL 16 with `postgis`, `citext`, `pgcrypto`; Mailpit (`compose.mailpit.yaml`). |
| Database | A **local, disposable** application database. Not the Traccar database, not shared. |
| Accounts | From Agent A's approved development fixtures: one test Admin (A1), optionally a second (A2), one test Commuter/Driver/Operator (U1). Test-only addresses (for example `*@example.test`). |
| Secrets | `.env` values and passwords stay on the operator's machine. Do not paste them into chat, commits, PRs, screenshots, or the status file. |

## 2. Start the API (operator, in `valryde-api`)

Follow `docs/integration/AGENT_A_FRONTEND_API_INTEGRATION_HANDOFF.md` §3.1:

```bash
npm ci
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

Check `http://127.0.0.1:3000/api/health` returns `{"status":"ok","database":"ok"}`.

## 3. Approved fixture accounts

Use only Agent A's already-seeded isolated development fixtures. Follow the merged API `docs/development/DEVELOPMENT_FIXTURES.md`; do not bootstrap unrelated accounts or run against shared/production data. Agent E does not modify, seed, migrate or start another agent's repository in this session. The fixture password is supplied at seed time and is not committed or known to the UI repository.

The automated real API runner uses `dev.admin@valryde.test` and `dev.commuter@valryde.test` by default, ordinary login/refresh/logout and bearer tokens. Tokens stay in memory. It logs check names and HTTP statuses only, never credentials or response bodies. Loopback and reserved fixture account restrictions are enforced. Rejected self-disable, unauthorized writes, invalid geometry/corridor and duplicate-label operations are negative tests; positive lifecycle/persistence remains separate browser/API acceptance.

```powershell
$env:VALRYDE_E2E_API_URL = 'http://127.0.0.1:3000'
$env:VALRYDE_E2E_PASSWORD = Read-Host 'Temporary fixture password' -MaskInput
try { node scripts/admin-api-acceptance.mjs }
finally { Remove-Item Env:VALRYDE_E2E_PASSWORD -ErrorAction SilentlyContinue }
```

A missing configuration produces `BLOCKED` before any test, not a pass. Missing required workflow fixtures produces `INCOMPLETE`, not full acceptance. The runner never seeds fixtures or touches the API repository.

## Synthetic browser regression

`scripts/admin-ui-smoke.cjs` serves the chosen production bundle on an ephemeral loopback port and intercepts API requests with explicit synthetic responses. Scenarios: `directory`, `transit`, `gps`, `identity`, `summary`, `tracking`. It exercises real forms, dialogs, routing, guards, responsive layout and non-Admin rejection, but it does not test the real backend or hardware.

Make Playwright available through the local tooling environment or set `VALRYDE_PLAYWRIGHT_MODULE` to its installed module directory. Set `VALRYDE_BROWSER_EXECUTABLE` to an installed Chromium/Chrome executable when bundled browser binaries are unavailable. `VALRYDE_BROWSER_WORKSPACE` selects an assigned admin worktree with a completed production build. The runner refuses workspaces outside this repository. No browser install or personal browser profile is required.

```powershell
node scripts/admin-ui-smoke.cjs directory
```

Reports/screenshots in `docs/testing/evidence/2026-10-23-rapid-delivery` explicitly identify synthetic evidence, full tested source HEAD and whether source files were dirty. Mobile captures wait for drawer layout to settle. These are regression evidence, not authenticated integration acceptance. Exact tested heads and source limitations are listed in the evidence README.
## 4. Start Valryde Admin (Agent E or operator, in `valryde-web-admin`)

```bash
npm start
```

The dev server proxies `/api` to `http://localhost:3000` (`proxy.conf.json`); CORS does not apply. If port 4200 is taken, `npm start -- --port 4201`.

## 5. Test cases

Record pass/fail, time, and request IDs only. Use browser DevTools → Network to confirm calls.

| # | Workflow | Steps | Expected |
|---|---|---|---|
| 1 | W-01 | Open `/identity/users` signed out | Redirect to `/sign-in?returnUrl=%2Fidentity%2Fusers` |
| 2 | W-01 | Sign in as A1 | `POST /api/auth/login` 200; lands on `/identity/users`; toolbar shows A1 |
| 3 | W-01 | Sign in with a wrong password | 401 `INVALID_CREDENTIALS`; "The email or password is incorrect."; password field cleared |
| 4 | W-01 | Sign in as U1 | Login 200, then `POST /api/auth/logout` 204; "does not have Administrator access"; nothing in `sessionStorage` |
| 5 | Session | Reload while signed in as A1 | `POST /api/auth/refresh` 200, user list reloads; no sign-in prompt |
| 6 | USER-01 | Search, role filter, status filter, sort, page size | List from `GET /api/admin/users/` 200; client-side filters match |
| 7 | USER-03 | Disable U1 → confirm | `PATCH /api/admin/users/{U1}/status` `{status:"DISABLED"}` 200; row shows Disabled; snackbar |
| 8 | USER-03 | Enable U1 → confirm | 200; row shows Active |
| 9 | Self-disable | A1's own row and detail page | Disable action unavailable; no PATCH sent |
| 10 | Server self-disable | Optional, DevTools console: send the PATCH for A1's own ID with A1's token | `400 VALIDATION_ERROR` "Administrators cannot disable themselves"; A1 stays Active |
| 11 | W-10 | A2 disables A1 (if A2 exists); then use A1's open tab | Next A1 call → 401 → refresh fails → `/sign-in?reason=session-expired` |
| 12 | Sign-out | Sign out from the user menu | `POST /api/auth/logout` 204; `sessionStorage` key removed; protected URL redirects to sign-in |
| 13 | Revocation | After 12, replay the old refresh token with `POST /api/auth/refresh` (DevTools) | `401 SESSION_REVOKED` |
| 14 | Rate limit | 11 wrong sign-ins within a minute | Server `500` + `retry-after` (Agent A D1); UI shows "Too many sign-in attempts" |
| 15 | W-11 | Stop the API, click Try again on the user list | Network error state with retry; no crash |
| 16 | ID 60 | Open Fleet Management → Jeepneys, then a jeepney | List and detail load; effective route shows direct/group/none or the 409 conflict notice |
| 17 | ID 61 | Create route `ZZ-TEST-1` (test-only code), then open it | `POST /api/admin/transit-routes` 201; detail shows Draft; list re-read includes it |
| 18 | ID 61 | Create `ZZ-TEST-1` again | `409 CONFLICT` shown on the route-code field; values kept |
| 19 | ID 61 | Edit the test route name and status → Inactive | Only changed fields in the PATCH body; confirmation shown; detail re-read shows the change |
| 20 | ID 61 | On a route with ≥ 2 directions, rename one to the other's label | Blocked client-side; a concurrent duplicate from another tab returns merged D3 `409 CONFLICT` and retains values |
| 21 | ID 64 | As U1 (Operator), submit a vehicle application for a test jeepney; as A1 approve it | Review PATCH 200; status re-read Approved; jeepney status updated by server |
| 22 | ID 64 | Approve the same application again from a second stale tab | `409 CONFLICT`; page re-reads and shows the existing decision |
| 23 | ID 63–64 | As U1 request GPS setup; as A1 approve, schedule (date), mark installed | Each transition confirmed and re-read; invalid transition attempts return 409 |
| 24 | ID 63 | Map a test device (test IMEI/serial/Traccar ID only) | 201; mapping re-read through G10 on reload; repeating with the same IMEI → `409 DEVICE_MAPPING_CONFLICT` |
| 25 | ID 63 | Verify with one check failing, then with all four passing | First → Failed; second → Verified and jeepney Active. Physical device reporting is **not** proven by this; that is a hardware gate |
| 26 | RBAC | Repeat any Admin write with U1's token (DevTools) | `403 FORBIDDEN`; nothing changes |

Test data for cases 17–25 must use obviously synthetic values (route codes starting `ZZ-TEST`, IMEIs from a test range agreed with the operator, Traccar IDs that do not exist in a production Traccar). There is no delete for routes, applications, requests or mappings: use a disposable database.

## 6. Evidence and reporting

- Save sanitized screenshots (test addresses only) under `docs/testing/evidence/<date>-real-api/`.
- Update the acceptance matrix and `docs/agent-status/AGENT_E_STATUS.md` with the results and the `valryde-api` SHA used.
- Remove or disable the local test accounts afterwards if the database is not disposable.

Read-only boundary smoke: `node scripts/admin-api-acceptance.mjs --unauthenticated`. A `PARTIAL_PASS` means only health and unauthenticated 401 checks ran; it is never authenticated or checklist acceptance.
