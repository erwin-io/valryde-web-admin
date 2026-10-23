# Rapid Delivery 004 — G1 real directory acceptance

Scope: IDs 57/58, PR #9. This adds acceptance tooling, not a successful authenticated result. API baseline: `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479`; approved API `http://127.0.0.1:3000`, isolated `valryde_ui_dev`, 41 development fixture records (Tech Lead baseline).

## Secure operator invocation

No credential file is used. Run this from an interactive PowerShell session; the fixture password is entered through a masked prompt. The launcher sets process variables, invokes the runner and restores previous variables in `finally`. Do not put the password in a command, transcript, `.env`, persistent environment or repository file.

```powershell
Set-Location C:\Development\valryde\valryde-web-admin\.worktrees\admin-takeover
.\scripts\Invoke-DirectoryAcceptance.ps1
```

Exact credential-related variables read by both runners:

| Variable | Required | Meaning |
|---|---|---|
| `VALRYDE_E2E_API_URL` | Yes | Launcher sets the approved `http://127.0.0.1:3000` |
| `VALRYDE_E2E_PASSWORD` | Yes | Shared seeded-fixture password supplied through the masked prompt |
| `VALRYDE_E2E_ADMIN_EMAIL` | Optional | Defaults to manifest `dev.admin@valryde.test` |
| `VALRYDE_E2E_COMMUTER_EMAIL` | Optional | Defaults to manifest `dev.commuter@valryde.test` |

Driver A and Operator A/B use their approved manifest emails and the same seed password. No password or token is printed. Missing configuration returns `CREDENTIALS_NOT_CONFIGURED` with exit code 2 before login. Incorrect credentials or contract assertions return `FAILED`, not a pass.

Optional real browser acceptance, after building this worktree:

```powershell
npm run build
$env:VALRYDE_PLAYWRIGHT_MODULE = 'C:/Users/Erwin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:VALRYDE_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
.\scripts\Invoke-DirectoryAcceptance.ps1 -Browser
```

Those two tooling variables are non-secret local paths and can be omitted if Playwright and its browser are already installed/resolvable. The real browser runner serves the production bundle through an ephemeral loopback server, proxies `/api` to the accepted API and never intercepts/mock-fills responses. It takes no screenshots or traces. Credentials/tokens remain in memory and sessions are submitted for revocation on cleanup. Network failure can prevent revocation.

## Prepared checks and evidence boundaries

- Normal Admin, Commuter, Driver and Operator A/B login; unauthenticated and non-Admin directory denials.
- Actual server pagination (distinct pages), search, business status, empty and invalid pagination, association and ownership filters.
- Public account identity vs business identity, owner relationships, fleet counts, assigned jeepney and group references.
- Operator A/B Driver scope; rejection of Admin-only filters; fleet tenant isolation.
- Expected rejected cross-operator Driver assignment and conflicting group membership; no positive business mutation or seeding.
- Refresh rotation, authorized use after refresh, logout and revoked refresh denial.
- Optional real browser: protected return URL, account/business links, operator-to-driver deep link, assignment/group links, search, responsive overflow, non-Admin rejection/revocation and Admin logout.

API PASS covers only listed assertions. The browser runner is a separate gate. A seeded application-DB mapping is synthetic fixture data even when fetched from a real API; it never proves a physical tracker or live telemetry. Operator lifecycle mutation and identity-navigation races require subsequent PR #13 acceptance. No item is marked Completed by this tooling.

## Current result — 2026-10-23

`LOCAL_API_CONNECTED / CREDENTIAL_SOURCE_APPROVED_INTERACTIVE / AUTHENTICATED_ACCEPTANCE_PENDING`.

Health 200/database `ok` and five unauthenticated boundaries 401 passed from this execution environment. Runtime checkout at the approved SHA and Node processes referencing that checkout were observed; health itself does not attest a deployed SHA or database name. No fixture password exists in this process; authenticated API and browser runners report `CREDENTIALS_NOT_CONFIGURED`, not a pass. Operator must run the masked launcher; no credential guessing or file discovery is authorized.
