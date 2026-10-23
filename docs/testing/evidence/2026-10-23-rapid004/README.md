# Rapid Delivery 004 — reviewed combined-source verification

## Result and boundaries

`LOCAL_API_CONNECTED / CREDENTIAL_SOURCE_APPROVED_INTERACTIVE / AUTHENTICATED_ACCEPTANCE_PENDING`.

This evidence tests a deliberately assembled, ignored validation export of the reviewed application changes from PRs #9–#14. No PR/branch was merged, no feature worktree application source was overwritten, and no API repository/database change was made. All six PRs remain independently reviewable. This is a local validation export, not a release artifact or a combined PR.

The export starts from frontend `origin/main` `1eb94279f5670ad71078b2ec27ba117905a75898`. Reviewed `src`/`scripts` diffs were applied in order #9, #13, #10, #11, #14, #12. They applied without source conflicts. Shared documentation is deliberately excluded from this assembled result; its reconciliation remains a G review task. No package, lockfile, Angular configuration or shared test-runner configuration differs between these PRs and the base. The constrained local Vitest configuration is ignored and not committed.

Exact input heads are in [combined-source-manifest.json](combined-source-manifest.json). Source fingerprint: `c9bc64b4dc336be2ca14049723182ccdb9500d31c18dc5a3518e7084a03e13c8` (SHA-256 over sorted relative source paths and bytes). The browser harness verifies this fingerprint before serving the export. It reports `sourceHead:null` plus `sourceComposite`, because there is no single PR HEAD for the assembled source. Later follow-ups affect test tools/docs only, not this application source.

## Actual fresh gates — 2026-10-23 10:52–11:02 +08:00

| Gate | Result |
|---|---|
| PR #9 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | PASS; 23 files / 156 tests; production initial 392.87 kB |
| Combined export `npm run lint` | PASS |
| Combined export `npm run typecheck` | PASS, app and spec |
| Combined export direct Angular test command below | PASS; 28 files / 211 tests |
| Combined export `npm run build` | PASS; production initial 393.48 kB |
| Combined browser directory / identity / transit / GPS / summary / tracking | PASS, each at 1440x900 and 375x812; no page errors |
| `npm audit --omit=dev --audit-level=high` | PASS, zero production findings |
| `npm audit --json` | NOT CLEAN: four development-tool packages, 1 low / 3 high; Angular build/CLI, MCP SDK and Vite; no automated dependency rewrite |
| Node syntax, PowerShell parser, whitespace checks | PASS for changed runners/launcher |
| Real API health and five unauthenticated protected boundaries | PARTIAL_PASS: health 200/database ok, all five 401 |
| Real full API / G1 API / G1 browser with absent credentials | `CREDENTIALS_NOT_CONFIGURED`; no authenticated assertion ran |

Versions inspected: Node 24.19.0, current npm 10.9.1 (manifest declares 11.6.2), Angular core 21.2.25, Angular CLI 21.2.27, TypeScript 5.9.3, Vitest 4.1.12. Dependency tree reused through an ignored junction; lockfiles unchanged.

```text
npm run lint
npm run typecheck
node node_modules/@angular/cli/bin/ng.js test --watch=false --runner-config=.angular/rapid-vitest.config.mjs --reporters=dot
npm run build
```

The ignored runner configuration is `export default { test: { maxWorkers: 2 } };`.

Browser invocation uses `scripts/admin-ui-smoke.cjs <scenario>`, installed Chrome and the bundled Playwright package. `VALRYDE_BROWSER_WORKSPACE` identifies the ignored export; `VALRYDE_BROWSER_SOURCE_MANIFEST` identifies its verified manifest; `VALRYDE_BROWSER_EVIDENCE_DIR` keeps these results separate from prior per-PR results. All API responses in these six browser scenarios are explicitly intercepted **synthetic** responses. PNGs contain only synthetic test identities. They prove neither real authentication nor persisted backend changes, tenant scope or physical tracker state.

## Real backend connection and credential gate

Approved runtime checkout `C:/Development/valryde/valryde-api-runtime` reports HEAD `810c8a13356ddbf0e28a4faf5ad7f86ce0a30479`; running Node command lines reference this runtime. `http://127.0.0.1:3000/api/health` returned 200/database `ok` from this execution environment. The five unauthenticated surfaces checked were operators, drivers, Admin users, Admin routes and G10 mapping read; all returned 401. Health does not itself attest the serving binary's commit or database name. The accepted database name/41-record readiness are Tech Lead evidence.

Tech Lead authorizes a masked interactive PowerShell prompt and process-only environment variables. No credential file/source is approved; none was read or created. Missing credentials must not be guessed. Use PR #9's [operator procedure](https://github.com/erwin-io/valryde-web-admin/blob/codex/admin-takeover-g1-g6/docs/testing/RAPID004_DIRECTORY_ACCEPTANCE.md) and launcher. The operator supplies the shared seeded-fixture password; the launcher sets `VALRYDE_E2E_API_URL` and `VALRYDE_E2E_PASSWORD` temporarily. Optional `VALRYDE_E2E_ADMIN_EMAIL` and `VALRYDE_E2E_COMMUTER_EMAIL` use approved fixture defaults. Real G1 tools are committed on the PR #9 branch, not copied into PR #14.

## Failed attempts / remaining scope

The first ignored export attempt hit Node's default archive buffer limit before extraction. A new export with an explicit 32 MiB buffer succeeded; the failed empty directory was preserved. Several initial PowerShell filename-glob/read commands failed and were corrected; no source work was lost. Actual authenticated checks remain NOT RUN. A new real-browser runner's logout selector was corrected by source inspection to open the user menu and select its menuitem; syntax/missing-credential checks passed, but its live behavior remains unverified.

No new checklist ID is recommended Completed. G review, secure interactive credentials and full functional integration acceptance remain required. Refer to [Rapid 004 audit and dependency matrix](../../RAPID004_PR_AUDIT.md).
