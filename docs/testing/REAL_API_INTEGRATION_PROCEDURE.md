# Real API Integration Procedure — Admin web

**Purpose:** repeatable verification of the Admin web (IDs 56, 59 from PR #2; 60; 61 from PR #5; 63–64 from PR #6) against a real local `valryde-api`, replacing the synthetic stubs used so far.
**State:** `OPERATOR-GATED` — not yet run. Per Tech Lead direction (2026-10-22) the test Admin and test users must come from **Agent A's approved development fixtures** when they exist, not from owner-created accounts. None exist on `valryde-api` `main` `827738c`.
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

## 3. Test accounts (local database only)

Use Agent A's development fixtures once approved; the steps below are the current manual reference from Agent A's handoff and are superseded by the fixtures.

- **A1 (first Admin):** `npm run admin:bootstrap` with `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_DISPLAY_NAME`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_CONFIRM=CREATE_FIRST_ADMIN` set as temporary shell variables (never in `.env`). Works only on an empty Admin set.
- **U1:** `POST /api/auth/register` with role `COMMUTER`, then verify through Mailpit (`http://127.0.0.1:8025`) and `POST /api/auth/verify-email`.
- **A2 (optional, for cases 9–10):** there is no API to grant `ADMIN`; the owner decides whether a second local Admin is created and how. Skip cases 9–10 otherwise.

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
| 20 | ID 61 | On a route with ≥ 2 directions, rename one to the other's label | Blocked client-side; no PATCH sent (Agent A D3 would return 500) |
| 21 | ID 64 | As U1 (Operator), submit a vehicle application for a test jeepney; as A1 approve it | Review PATCH 200; status re-read Approved; jeepney status updated by server |
| 22 | ID 64 | Approve the same application again from a second stale tab | `409 CONFLICT`; page re-reads and shows the existing decision |
| 23 | ID 63–64 | As U1 request GPS setup; as A1 approve, schedule (date), mark installed | Each transition confirmed and re-read; invalid transition attempts return 409 |
| 24 | ID 63 | Map a test device (test IMEI/serial/Traccar ID only) | 201; mapping shown once; repeating with the same IMEI → `409 DEVICE_MAPPING_CONFLICT` |
| 25 | ID 63 | Verify with one check failing, then with all four passing | First → Failed; second → Verified and jeepney Active. Physical device reporting is **not** proven by this; that is a hardware gate |
| 26 | RBAC | Repeat any Admin write with U1's token (DevTools) | `403 FORBIDDEN`; nothing changes |

Test data for cases 17–25 must use obviously synthetic values (route codes starting `ZZ-TEST`, IMEIs from a test range agreed with the operator, Traccar IDs that do not exist in a production Traccar). There is no delete for routes, applications, requests or mappings: use a disposable database.

## 6. Evidence and reporting

- Save sanitized screenshots (test addresses only) under `docs/testing/evidence/<date>-real-api/`.
- Update the acceptance matrix and `docs/agent-status/AGENT_E_STATUS.md` with the results and the `valryde-api` SHA used.
- Remove or disable the local test accounts afterwards if the database is not disposable.
