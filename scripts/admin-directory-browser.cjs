/** Production bundle + REAL loopback API only. No API interception, synthetic data or screenshots. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const checks = [], pageErrors = [];
const api = process.env.VALRYDE_E2E_API_URL;
const password = process.env.VALRYDE_E2E_PASSWORD;
const adminEmail = process.env.VALRYDE_E2E_ADMIN_EMAIL || 'dev.admin@valryde.test';
const commuterEmail = process.env.VALRYDE_E2E_COMMUTER_EMAIL || 'dev.commuter@valryde.test';
const report = (state, reason) => console.log(JSON.stringify({ suite: 'real-g1-browser', evidence: 'REAL_API_ONLY', state,
  reason, checks, pageErrorCount: pageErrors.length }, null, 2));
if (!api || !password) {
  report('CREDENTIALS_NOT_CONFIGURED', 'Supply current-process VALRYDE_E2E_API_URL and VALRYDE_E2E_PASSWORD. No browser login ran.');
  process.exit(2);
}
if (api !== 'http://127.0.0.1:3000' || ![adminEmail, commuterEmail].every(v => v.endsWith('@valryde.test'))) {
  report('CONFIGURATION_REJECTED', 'Only approved local API and fixture accounts are allowed.'); process.exit(2);
}
const dist = path.resolve(__dirname, '../dist/valryde-admin/browser');
let browser, server;
const contexts = [];
(async () => {
  assert(fs.existsSync(path.join(dist, 'index.html')), 'Build this worktree first');
  const { chromium } = require(process.env.VALRYDE_PLAYWRIGHT_MODULE || 'playwright');
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const upstream = http.request(api + request.url, {
        method: request.method, headers: { ...request.headers, host: '127.0.0.1:3000' },
      }, result => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
      upstream.on('error', () => { response.writeHead(502); response.end(); });
      request.pipe(upstream); return;
    }
    try {
      let file = path.resolve(dist, '.' + decodeURIComponent(pathname));
      if (!file.startsWith(dist + path.sep) && file !== dist) { response.writeHead(403); response.end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(response);
    } catch { response.writeHead(400); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.VALRYDE_BROWSER_EXECUTABLE ? { executablePath: process.env.VALRYDE_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(context);
  const page = await context.newPage(); page.on('pageerror', () => pageErrors.push(true));
  const operatorsResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/operators' && r.status() === 200);
  await page.goto(origin + '/fleet/operators');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const operators = (await (await operatorsResponse).json()).operators;
  await page.waitForURL('**/fleet/operators');
  const op = operators.find(o => o.email === 'dev.operator-a@valryde.test'); assert(op);
  const row = page.getByRole('row').filter({ hasText: op.email });
  const account = row.getByRole('link', { name: op.displayName, exact: true });
  assert((await account.getAttribute('href')).endsWith('/identity/users/' + op.ownerUserId));
  assert.notEqual(op.operatorId, op.ownerUserId);
  checks.push('Real Admin sign-in, protected return URL and account/business identity link');
  const driversResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/drivers' && r.status() === 200);
  await row.getByRole('link', { name: `${op.driverCount} drivers`, exact: true }).click();
  const drivers = (await (await driversResponse).json()).drivers;
  assert(drivers.length > 0 && drivers.every(d => d.operatorId === op.operatorId));
  assert.equal(new URL(page.url()).searchParams.get('operatorId'), op.operatorId);
  const assigned = drivers.find(d => d.activeJeepneyId); assert(assigned);
  const driverRow = page.getByRole('row').filter({ hasText: assigned.email });
  assert((await driverRow.getByRole('link', { name: 'Assigned jeepney', exact: true }).getAttribute('href')).endsWith(assigned.activeJeepneyId));
  for (const groupId of assigned.groupIds) assert(await driverRow.locator(`a[href$="/fleet/groups/${groupId}"]`).count());
  checks.push('Real ownership deep link, assigned jeepney and group context');
  await page.getByLabel('Search name or email', { exact: true }).fill('no-such-fixture-004');
  const emptyResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/drivers' && r.status() === 200);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  assert.equal((await (await emptyResponse).json()).pagination.total, 0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).waitFor();
  checks.push('Real server search returns successful empty result');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.waitForFunction(() => {
      const content = document.querySelector('mat-sidenav-content');
      return innerWidth >= 960 || (!!content && Math.abs(parseFloat(getComputedStyle(content).marginLeft)) < 1);
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  checks.push('Desktop/mobile no document overflow');
  const deniedContext = await browser.newContext();
  contexts.push(deniedContext);
  const denied = await deniedContext.newPage();
  await denied.goto(origin + '/fleet/operators');
  await denied.getByLabel('Email', { exact: true }).fill(commuterEmail);
  await denied.getByLabel('Password', { exact: true }).fill(password);
  const revoke = denied.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/logout' && r.status() === 204);
  await denied.getByRole('button', { name: 'Sign in', exact: true }).click();
  await denied.getByRole('alert').filter({ hasText: 'This account does not have Administrator access to Valryde Admin.' }).waitFor();
  await revoke;
  assert.equal(await denied.evaluate(() => sessionStorage.length), 0);
  checks.push('Real non-Admin rejected by UI, issued refresh revoked and no stored session');
  await deniedContext.close();
  // UI logout revokes the active session; refresh after reload is separately covered by the API runner.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL('**/sign-in');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  checks.push('Real Admin UI logout clears session');
  assert.equal(pageErrors.length, 0);
  checks.push('Tested source HEAD ' + execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim());
  report('PASS', 'Only listed real browser scenarios passed; no physical tracking claim.');
})().catch(() => { report('FAILED', 'Real browser check failed; private page contents and credentials are suppressed.'); process.exitCode = 1; })
  .finally(async () => {
    for (const context of contexts) {
      for (const page of context.pages()) {
        try {
          const refreshToken = await page.evaluate(() => sessionStorage.getItem('valryde.admin.refreshToken'));
          if (refreshToken) await context.request.post(api + '/api/auth/logout', { data: { refreshToken } });
        } catch { /* Closed page/network failure: do not print secrets. */ }
      }
    }
    await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve));
  });
