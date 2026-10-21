# Real API Integration Procedure — Admin sign-in and User Accounts

**Purpose:** repeatable verification of PR #2 (IDs 56, 59) against a real local `valryde-api`, replacing the synthetic stub used so far.
**State:** `OPERATOR-GATED` — not yet run. Requires an owner-approved local test backend and test Admin account.
**Never** run this against production, a shared database, or real user records.

## 1. Preconditions (owner/operator)

| Item | Requirement |
|---|---|
| API source | `valryde-api` `main` at or after `4a9a152`, in its own checkout. Agent E does not modify it. |
| Runtime | Node.js ≥ 22.12, PostgreSQL 16 with `postgis`, `citext`, `pgcrypto`; Mailpit (`compose.mailpit.yaml`). |
| Database | A **local, disposable** application database. Not the Traccar database, not shared. |
| Accounts | One test Admin (A1), one second test Admin (A2), one test Commuter or Driver (U1). All test-only addresses (for example `*@example.test`). |
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

## 3. Create test accounts (operator, local database only)

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

## 6. Evidence and reporting

- Save sanitized screenshots (test addresses only) under `docs/testing/evidence/<date>-real-api/`.
- Update the acceptance matrix and `docs/agent-status/AGENT_E_STATUS.md` with the results and the `valryde-api` SHA used.
- Remove or disable the local test accounts afterwards if the database is not disposable.
