# Agent E rapid-delivery evidence — 2026-10-23

Directive: `VALRYDE-E-RAPID-DELIVERY-003`. Source is review-ready in separate, unmerged PRs. **No new checklist item is accepted or completion-ready from this evidence alone.**

## Source and automated gates

Each source slice passed Angular lint, strict app/spec typecheck, a full unit/component suite, production build and `git diff --check`. Test counts include the shared baseline and must not be summed as unique tests.

| Slice | PR | Tested source HEAD | Full suite |
|---|---|---|---:|
| G1 Operator/Driver directories | [9](https://github.com/erwin-io/valryde-web-admin/pull/9) | `e33baf46950a3e2b1011ca4cad2b9b3f6efad497` | 156 |
| Direction creation, route color suggestion, corridor/G11/D3 | [10](https://github.com/erwin-io/valryde-web-admin/pull/10) | `e315d1f682be61bd65b35b142727b0b312c64a6a` | 176 |
| G10 mapping reconciliation and GPS action guards | [11](https://github.com/erwin-io/valryde-web-admin/pull/11) | `cba601b7912558b3504afbe4620552c79818d66f` | 158 |
| Tracking/deviation adapter preparation | [12](https://github.com/erwin-io/valryde-web-admin/pull/12) | `423f31aff5bf082aa128ce08328e7eeb934be9cc` | 167 |
| Account-detail scope/response races | [13](https://github.com/erwin-io/valryde-web-admin/pull/13) | `03c3864349dec6a9d5d90e5134e43d27b1e666f5` | 159 |
| Operational report, component health and G2 members | [14](https://github.com/erwin-io/valryde-web-admin/pull/14) | `dcb5d6d30bafb83ae3af4e93c56dc2ad28d86514` | 165 |

The constrained full runs used an ignored local `.angular/rapid-vitest.config.mjs` containing `export default { test: { maxWorkers: 2 } };`:

```text
npm run lint
npm run typecheck
node node_modules/@angular/cli/bin/ng.js test --watch=false --runner-config=.angular/rapid-vitest.config.mjs --reporters=dot
npm run build
git diff --check
```

Directory verification used ordinary `npm test`. Earlier transit `npm test -- --include=...` arguments were consumed by npm 10 and ran the full suite; the final 176-test run used the direct Angular CLI command above. Production dependency audit reported zero vulnerabilities; no dependency/lockfile change was made.

## Synthetic browser evidence

All `*-report.json` and PNG files here are **SYNTHETIC_BROWSER_ONLY**. `scripts/admin-ui-smoke.cjs` serves the production bundle with an ephemeral loopback server and explicitly intercepted synthetic API responses. Installed Chrome runs in a temporary automation profile. No personal browser profile, real API login, provider credential or physical GPS is used.

Reports record full source HEAD, whether source files were dirty, checks, uncaught page errors and request paths/methods/statuses. They do not record passwords, tokens, headers or response bodies. Final reports should show `sourceDirty: false`; an initial operational-summary run on uncommitted code was superseded by the committed-source rerun.

- `directory`: G1 counts, account/business identity links, operator-to-driver filter, assignment/group context, server 403 UI.
- `transit`: explicit color suggestion/choice, direction creation from GeoJSON, canonical list re-read, corridor impact confirmation/persistence and actual MapLibre geometry canvas initialization.
- `gps`: approve, schedule, mark installed, map device, read-after-write and fresh-visit mapping restoration. All requests and installation results are synthetic; no physical verification is asserted.
- `identity`: SPA route reuse loads the new identity, status confirmation and self-disable guard.
- `summary`: server totals, CSV download filename, injected-repository health label, G2 member rendering. Print/save-PDF action exists; native PDF output is not verified.
- `tracking`: both guarded routes show the unconfigured production default, without synthetic live vehicles. Injected tracking behavior is covered by component tests with WebGL disabled; no actual tracking gateway is integrated.

Every scenario also checks synthetic non-Admin sign-in rejection without storing a session. Captures at 1440×900 and 375×812 wait for the navigation drawer to finish transitioning and assert no document-level horizontal overflow. Directory tables retain their internal horizontal scrolling. `summary-*.png` captures G2 membership; `summary-report-1440.png` captures counts/health. No uncaught page errors occurred in final runs.

## Real API evidence and exact gates

On resume at approximately 10:12 +08:00, the local API became reachable. `node scripts/admin-api-acceptance.mjs --unauthenticated` reported **PARTIAL_PASS**: real health 200 with database `ok`, and real unauthenticated 401 for operators, drivers, Admin users, Admin transit routes and G10 mapping read. These were read-only checks; no credentials, private data or writes were used.

Full `node scripts/admin-api-acceptance.mjs` reported **BLOCKED before any login/test** because the temporary fixture password and explicit authenticated-test configuration were absent. Backend fixture tooling is merged; it is no longer correct to say fixture PR #15 is unmerged. API main `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479` was reverified against GitHub; the running service's deployed source SHA has not been independently certified.

The full runner requires an already-seeded isolated loopback development database and Agent A fixture credentials supplied through a secure local source. It does not seed, migrate or start the API repository. It checks normal Admin/Commuter login, server authorization boundaries, G1/G2/G10/G11, rejected self-disable/unauthorized writes/invalid geometry/corridor/D3 conflicts, refresh rotation and logout/revocation. Missing fixtures yield `INCOMPLETE`, not full acceptance. Positive real lifecycle/persistence, real browser authentication and any hardware acceptance remain separate required evidence.

Missing external dependencies: operator-profile create/update and standalone geofence contracts; actual B REST/Pusher/auth/compliance-history/component-health release; approved basemap configuration; physical GPS/Traccar installation and device evidence; deployment configuration and Agent G acceptance. No self-merge or production deployment was performed.

## Failed attempts preserved

The canonical Agent E activity log records initial template TS7053, npm 10 install/argument limitations, harmless relative-junction failure, GPS baseline timing failure followed by successful full rerun, missing router provider/cascading test failures corrected before 159-test rerun, missing ignored runner config, obsolete route-link assertion corrected before 176-test pass, browser path-separator guard correction, absent bundled browser binaries, exact-text selector correction and screenshots initially captured during drawer animation. These are not counted as passes.
