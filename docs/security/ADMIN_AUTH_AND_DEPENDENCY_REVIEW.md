# Admin Authentication and Dependency Security Review

**Scope:** PR #2 (`feat/56-59-admin-shell-user-accounts`), checklist IDs 56 and 59.
**Reviewed against:** Agent A `valryde-api` `main` `4a9a152` (includes the frontend API handoff from API PR #6; auth and Admin-user source unchanged since `711f4c4`).
**Date:** 2026-10-21. Executor: Claude (Agent E). This is a self-review for the Tech Lead; it is not an acceptance decision.

## 1. Authentication design as implemented

| Area | Implementation | Assessment |
|---|---|---|
| Access token | Held in an Angular signal (memory) only; sent as `Authorization: Bearer` to the same-origin `/api` base only (`auth.interceptor.ts`). Never persisted. | Matches Agent A §1.1 (bearer, no cookies, CORS `credentials: false`). |
| Refresh token | `sessionStorage['valryde.admin.refreshToken']`. Survives reload in the same tab; removed when the tab closes or on sign-out. | Acceptable interim; XSS risk analysed in §3. |
| Rotation | Every `POST /api/auth/refresh` returns a new refresh token; the client replaces the stored one. Server revokes the whole token family when a rotated token is replayed (`test/auth.test.ts` "rotates refresh tokens and revokes the family…"). | Correct. |
| Concurrent requests | One shared in-flight refresh (`refreshInFlight` + `shareReplay(1)`); every 401 waits on it, then retries once with the new token. No second refresh is sent, so the client never triggers replay detection on itself. | Correct; covered by interceptor tests. |
| Logout / revocation | Waits for any in-flight refresh, clears local state, then `POST /api/auth/logout` with the newest refresh token. Local state is cleared even if the network call fails. | **Fixed in this review** (defect S1 below). |
| Admin-only role | Login response without `ADMIN` → refresh token revoked server-side, `ADMIN_ROLE_REQUIRED` shown, nothing stored. A refresh that returns a non-Admin user clears local state and revokes the new token. Route guard sends non-Admin sessions to `/access-denied`. | **Refresh path fixed in this review** (defect S2). Guard is UX only. |
| Auth failures / expiry | 401 on a protected call → one refresh → retry. Refresh failure (`SESSION_REVOKED`, disabled user, revoked family) → clear session, `/sign-in?reason=session-expired&returnUrl=…`. 403 is shown as permission denied without clearing the session. | Matches Agent A §1.2. |
| Unauthorized status changes | Server: `requireRoles('ADMIN')` on both Admin-user routes; self-disable rejected in the handler. Client: disable action hidden/disabled for the signed-in Admin; confirmation dialog before every change; failures stay visible with request ID. | Server verified (§2). |
| Open redirect | `returnUrl` accepted only if it starts with a single `/`, has no backslash, and is not an auth page; otherwise `/dashboard`. Navigation uses the Angular router, which cannot leave the origin. | Correct; unit-tested. |
| XSS sinks | No `innerHTML`, `bypassSecurityTrust*`, `eval`, `document.write`, or `localStorage` in `src/`. All rendering goes through Angular template escaping. | No sink found. |

## 2. Backend verification (Agent A `main` `4a9a152`)

Run on 2026-10-21 in an isolated scratchpad export (`git archive origin/main`) with the in-memory identity repository and Fastify `inject()`; nothing was written to `valryde-api`. Probe source: [`docs/testing/evidence/2026-10-21-security-review/agent-a-status-rbac-probe.test.ts.txt`](../testing/evidence/2026-10-21-security-review/agent-a-status-rbac-probe.test.ts.txt).

| Case | Request | Result |
|---|---|---|
| No token | `PATCH /api/admin/users/{id}/status` | `401 AUTH_REQUIRED` |
| Commuter, Driver, Operator caller | same | `403 FORBIDDEN`; target unchanged |
| Admin disables self | same, own ID, `DISABLED` | `400 VALIDATION_ERROR`; account stays `ACTIVE` |
| Admin disabled by another Admin, old token reused | any Admin call | `401 SESSION_REVOKED` |
| Invalid status / non-UUID path / unknown UUID | | `400` / `400` / `404` |
| Extra body field `roles: ['ADMIN']` | | `200`; field stripped by AJV (`removeAdditional`), roles unchanged. Not exploitable, but the API does not *reject* unknown fields as `additionalProperties: false` suggests. Reported to Agent A, no client impact. |
| `GET /api/admin/users/` (trailing slash, as used by the client) | | `200`, `PublicUser` keys exactly `id, email, displayName, status, emailVerified, roles, createdAt, updatedAt` |
| 11 logins in one minute | `POST /api/auth/login` | `500` with `retry-after` (Agent A defect D1 confirmed); client now shows the rate-limit message for this case |
| Agent A's own `test/auth.test.ts` | | 9/9 passed (includes commuter → `403` on user list, disable invalidates the target's token, refresh replay revokes the family) |

## 3. Practical risk of `sessionStorage` for the refresh token

- **Any XSS in the Admin origin can read it.** `sessionStorage` is readable by every script running in the page. A stolen refresh token can be used from another machine until it expires (Agent A default `refreshTokenTtlDays` = 30) or until the legitimate tab refreshes and replay detection revokes the family (then both lose the session, which limits but does not prevent abuse).
- **The memory-only access token is not a strong defence against XSS either.** Injected script can call the API from inside the page or wrap `fetch`/`XMLHttpRequest` to capture the bearer header. The extra exposure from `sessionStorage` is *offline, long-lived* reuse of the refresh token after the tab is closed.
- **Not shared across tabs**, but *Duplicate tab* copies `sessionStorage`. The first tab to refresh rotates the token; the second tab's refresh is a replay, and the server revokes the family, signing out both. This fails safe (UX cost only).
- **Logout does not end the current access token.** Agent A's logout revokes the refresh session only; an access JWT stays valid until expiry (default 900 s) unless the user is disabled or changes password. This is a backend design property, not a client defect.
- **Mitigating factors today:** no XSS sinks in source, Angular auto-escaping, no third-party scripts (only Google Fonts CSS), strict TypeScript templates.

## 4. Recommended approach

**Within current contracts (Agent E can do; no API change):**

1. Keep access token in memory and refresh token in `sessionStorage` (current). Reject `localStorage` and memory-only refresh (memory-only signs the Admin out on every reload without materially reducing XSS impact).
2. Ship a strict **Content-Security-Policy** from the hosting layer for the Admin origin: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (or nonce via Angular `autoCsp`/`ngCspNonce`), `connect-src 'self'`, `img-src 'self' data:`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, plus `require-trusted-types-for 'script'` once verified with Angular's Trusted Types support. Add `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`. Hosting is owner/infra scope; values to be confirmed with the deployed MapLibre/OpenFreeMap origins when that module lands.
3. Self-host the Roboto and Material Icons fonts to remove the only third-party origin.
4. Keep the "no HTML sinks" rule enforced in review.

**Safest production target (needs Agent A contract change and Tech Lead approval; not implemented):**

- Refresh token in a `__Host-` `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` cookie set by the same-origin API, access token still in memory; CSRF defence by `SameSite=Strict` plus an `Origin` check on `/api/auth/refresh` and `/api/auth/logout`.
- Shorter Admin refresh lifetime (for example 8–12 h absolute) and a session ID claim in access tokens so logout can invalidate them immediately.

## 5. Defects found and fixed in PR #2

| ID | Severity | Defect | Fix | Regression test |
|---|---|---|---|---|
| S1 | Medium | Signing out while a token refresh was in flight revoked the *old* refresh token. The refresh then completed, stored the *rotated* token, and restored the signed-in state; the rotated session stayed valid server-side. | `logout()` waits for the in-flight refresh before reading and revoking the newest token. | `auth.service.spec.ts` "revokes the rotated token when sign-out races an in-flight refresh" (failed before the fix) |
| S2 | Low | A refresh returning a user without `ADMIN` cleared local state but left the newly issued refresh session valid server-side. | Revoke the new refresh token before rejecting. | "revokes a refreshed session whose user is no longer an Admin" (failed before the fix) |
| S3 | Low (UX) | Rate-limited sign-in showed a generic server error because Agent A returns `500` + `retry-after` (D1) instead of `429`. | Treat a `retry-after` header as rate limiting in the sign-in message. | `sign-in.page.spec.ts` "explains rate limiting reported as 500 with retry-after" |

Known, accepted, not changed: a network failure during page-load session restore clears the stored refresh token (user signs in again; fails safe).

## 6. Development-dependency advisories

`npm audit --omit=dev`: **0** (nothing below ships in the production bundle).
`npm audit` (all): 4 packages flagged.

| Package (installed) | Pulled in by | Advisories | Patched | Exploit conditions here |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` 1.31.0 (high) | `@angular/cli` 21.2.27 (pinned exactly `1.31.0`) | GHSA-22jm-h49p-29qw, GHSA-6prh-2h8m-c8cw, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq | 1.32.0+ (1.32.1 current) | Only reachable through the `ng mcp` command (Angular CLI MCP server for AI editors). Not configured in this repo (the generated `.vscode/mcp.json` was removed). The flagged issues concern HTTP transports, OAuth redirects, server bearer auth and request-size validation; `ng mcp` uses stdio. Practical risk: very low unless a developer enables `ng mcp`. |
| `@angular/cli` 21.2.27 (high) | direct dev dependency | via the SDK above | Fixed range starts at 22.2.0 | as above |
| `vite` 7.3.6 (moderate) | `@angular/build` 21.2.27 (pinned exactly `7.3.6`), `vitest` | bundled `launch-editor`: GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm | 7.3.7 | Dev server only (`ng serve`, `ng test`). Vite 7.3.6 registers `/__open-in-editor` unconditionally (`vite/dist/node/chunks/config.js`), and `ng serve` runs on Vite, so the endpoint is present. Exploitation needs a crafted request to it, on Windows, with certain editors; a malicious web page visited while `ng serve` runs could attempt it. Developer-workstation risk, not production. |
| `@angular/build` 21.2.27 (moderate) | direct dev dependency | via `vite` | Fixed range starts at 22.1.0 | as above |

**Can it be fixed without an Angular major upgrade?** Not with normal updates: 21.2.27 is the newest Angular 21 release and pins both vulnerable versions exactly; `npm audit fix --force` would *downgrade* Angular and was not run. The only in-major route is npm `overrides` (`vite` → 7.3.7, `@modelcontextprotocol/sdk` → 1.32.1). That is a forced resolution against Angular's pins and was **not applied** per instructions; it would need Tech Lead approval and a build/test rerun.

**Is Angular 22 justified?** Yes, as its own reviewed PR after PR #2 is accepted: it is the supported fix for all four findings and keeps the project on the current major. Prerequisite (owner decision): Angular 22 requires Node `^22.22.3 || ^24.15.0 || >=26`. This workstation runs 22.17.1 and already has **Node 24.15.0 installed under nvm**, but `nvm use` on Windows switches Node globally for every Valryde repo; Agent A's API declares Node ≥ 22.12, so 24.15 should satisfy it, but each agent would need to re-verify.

**Interim developer mitigations:** do not run `ng mcp`; keep `ng serve` bound to localhost (default); stop the dev server when not in use.
