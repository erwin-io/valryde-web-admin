/** Browser regression against explicit SYNTHETIC API responses. No real API/credentials used.
 * Set VALRYDE_PLAYWRIGHT_MODULE if playwright is not installed in the tooling environment.
 * Usage: node scripts/admin-ui-smoke.cjs directory|transit|gps|summary|tracking|identity
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.VALRYDE_PLAYWRIGHT_MODULE || 'playwright');
const workspace = fs.realpathSync(process.env.VALRYDE_BROWSER_WORKSPACE || process.cwd());
const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: __dirname, encoding: 'utf8' }).trim();
const repository = path.dirname(path.resolve(commonDir));
assert(workspace.toLowerCase().startsWith(repository.toLowerCase() + path.sep) || workspace.toLowerCase() === repository.toLowerCase());
const dist = path.join(workspace, 'dist/valryde-admin/browser');
assert(fs.existsSync(path.join(dist, 'index.html')), 'Run the production build first');
const mode = process.argv[2];
assert(['directory', 'transit', 'gps', 'summary', 'tracking', 'identity'].includes(mode), 'Select an explicit synthetic scenario');
const evidence = path.resolve(__dirname, '../docs/testing/evidence/2026-10-23-rapid-delivery');
fs.mkdirSync(evidence, { recursive: true });
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
const sourceDirty = !!execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src', 'angular.json', 'package.json', 'package-lock.json'], { cwd: workspace, encoding: 'utf8' }).trim() ||
  !!execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src'], { cwd: workspace, encoding: 'utf8' }).trim();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stamp = '2026-10-22T00:00:00.000Z';
const user = (n, role) => ({ id: uid(n), email: `${role.toLowerCase()}@example.test`, displayName: `Synthetic ${role}`,
  status: 'ACTIVE', emailVerified: true, roles: [role], createdAt: stamp, updatedAt: stamp });
const admin = user(1, 'ADMIN'), commuter = user(2, 'COMMUTER'), operator = user(3, 'OPERATOR'), driver = user(4, 'DRIVER');
const direction = { id: uid(5), routeId: uid(6), directionLabel: 'Northbound', originName: 'Bulacao', destinationName: 'Colon',
  corridorM: 100, status: 'ACTIVE', geometry: { type: 'LineString', coordinates: [[123.86, 10.26], [123.88, 10.28]] }, createdAt: stamp, updatedAt: stamp };
const routeRecord = { id: uid(6), routeCode: 'DEV-SYN', publicName: 'Synthetic route', description: 'Synthetic only',
  routeColorHex: '#43A047', status: 'ACTIVE', directions: [direction], createdAt: stamp, updatedAt: stamp };
const jeepney = { id: uid(7), operatorId: uid(8), plateNo: 'SYN-001', colorHex: '#1E88E5', description: null, status: 'ACTIVE', approvedAt: stamp, createdAt: stamp, updatedAt: stamp };
const group = { id: uid(9), operatorId: uid(8), name: 'Synthetic group', status: 'ACTIVE', description: null, createdAt: stamp, updatedAt: stamp };
const gps = { id: uid(10), jeepneyId: jeepney.id, vehicleApplicationId: uid(11), requestedByUserId: operator.id,
  status: 'PENDING', verificationStatus: 'NOT_STARTED', scheduledAt: null, installedAt: null, rejectedReason: null,
  verificationChecks: {}, verifiedByUserId: null, verifiedAt: null, createdAt: stamp, updatedAt: stamp };
const logs = [], pageErrors = [], checks = [];
let mapping = null, denyDirectory = false;
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + path.sep) && file !== dist) { response.writeHead(403); response.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(400); response.end(); }
});
function tokens(account) { return { accessToken: `synthetic-${account.roles[0]}`, refreshToken: 'synthetic-refresh-padding-not-a-real-token',
  accessTokenExpiresIn: 900, refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(), user: account }; }
const pagination = total => ({ page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20) });
async function mock(context) {
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method();
    const body = req.postDataJSON();
    const reply = async (data, status = 200) => { logs.push({ path: p, method, status }); await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data) }); };
    const denied = () => reply({ error: { code: 'FORBIDDEN', message: 'Synthetic authorization denial', requestId: 'req-synthetic' } }, 403);
    if (p === '/api/auth/login') return reply(tokens(body.email.startsWith('commuter') ? commuter : admin));
    if (p === '/api/auth/refresh') return reply(tokens(admin));
    if (p === '/api/auth/logout') return reply(null, 204);
    if (p === '/api/auth/me') return reply({ user: admin });
    if (p === '/api/health') return reply({ status: 'ok', database: 'injected' });
    if (!req.headers().authorization) return reply({ error: { code: 'AUTH_REQUIRED', message: 'Synthetic sign-in required', requestId: 'req-synthetic' } }, 401);
    if (p === '/api/admin/users/') return reply({ users: [admin, commuter, operator, driver] });
    if (p.endsWith('/status') && p.startsWith('/api/admin/users/')) { const account = [admin, commuter, operator, driver].find(u => p.includes(u.id)); account.status = body.status; return reply({ user: account }); }
    if (p === '/api/operators') return denyDirectory ? denied() : reply({ operators: [{ ...operator, operatorId: uid(8), ownerUserId: operator.id, userStatus: 'ACTIVE', driverCount: 2, jeepneyCount: 1, groupCount: 1 }], pagination: pagination(41) });
    if (p === '/api/drivers') return denyDirectory ? denied() : reply({ drivers: [{ ...driver, driverId: uid(12), userId: driver.id, userStatus: 'ACTIVE', operatorId: uid(8), activeJeepneyId: jeepney.id, groupIds: [group.id] }], pagination: pagination(1) });
    if (p === '/api/jeepneys') return reply({ jeepneys: [jeepney] });
    if (p.endsWith('/effective-route')) return reply({ effectiveRouteDirection: null });
    if (p === '/api/fleet-groups') return reply({ groups: [group] });
    if (p.endsWith('/members')) return reply({ members: [{ memberType: 'DRIVER', driverId: uid(12), displayName: driver.displayName, status: 'ACTIVE', activeJeepneyId: jeepney.id }], pagination: pagination(1) });
    if (p === '/api/admin/transit-routes') return reply({ routes: [routeRecord] });
    if (p === `/api/admin/transit-routes/${routeRecord.id}` && method === 'PATCH') { Object.assign(routeRecord, body); return reply({ route: routeRecord }); }
    if (p === `/api/admin/transit-routes/${routeRecord.id}/directions` && method === 'POST') {
      const created = { id: uid(15), routeId: routeRecord.id, status: 'DRAFT', createdAt: stamp, updatedAt: stamp, ...body };
      routeRecord.directions.push(created); return reply({ direction: created }, 201);
    }
    if (p.endsWith('/assignment-impact')) return reply({ impact: { routeDirectionId: direction.id, affectedJeepneyCount: 42, activeDirectAssignmentCount: 2, activeGroupAssignmentCount: 3, affectedJeepneys: [] }, pagination: pagination(42) });
    if (p === `/api/admin/route-directions/${direction.id}` && method === 'PATCH') { Object.assign(direction, body); return reply({ direction }); }
    if (p === '/api/vehicle-applications') return reply({ applications: [] });
    if (p === '/api/gps-setup-requests') return reply({ requests: [gps] });
    if (p.startsWith(`/api/admin/gps-setup-requests/${gps.id}`)) {
      if (p.endsWith('/device-mapping') && method === 'GET') return reply({ mapping });
      if (p.endsWith('/device-mapping')) { mapping = { id: uid(13), gpsSetupRequestId: gps.id, gpsDeviceId: uid(14), jeepneyId: jeepney.id, ...body, mappedAt: stamp }; return reply({ mapping }, 201); }
      if (p.endsWith('/verification')) { gps.verificationStatus = 'VERIFIED'; gps.verificationChecks = body; return reply({ request: gps }); }
      Object.assign(gps, body); return reply({ request: gps });
    }
    return reply({ error: { code: 'NOT_FOUND', message: 'Synthetic handler absent', requestId: 'req-synthetic' } }, 404);
  });
}
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.VALRYDE_BROWSER_EXECUTABLE || chromium.executablePath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await mock(context);
  const page = await context.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin + '/fleet/operators'); await page.getByLabel('Email', { exact: true }).fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-browser-input-only'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/fleet/operators'); checks.push('Protected URL returns after synthetic Admin sign-in');
  const go = async pathname => { await page.goto(origin + pathname); await page.locator('app-page-header h1').waitFor(); };
  if (mode === 'directory') {
    await page.getByText('2 drivers', { exact: true }).waitFor(); checks.push('G1 server counts and business/account link');
    await page.getByRole('link', { name: '2 drivers', exact: true }).click();
    await page.getByText('Assigned jeepney', { exact: true }).waitFor(); assert(page.url().includes('operatorId='));
    checks.push('Operator deep link filters Driver directory and displays assignment/group');
    denyDirectory = true; await go('/fleet/drivers'); await page.getByText('You do not have permission', { exact: false }).waitFor();
    checks.push('Directory 403 displays permission state'); denyDirectory = false; await go('/fleet/drivers');
    await page.getByText('Assigned jeepney', { exact: true }).waitFor();
  } else if (mode === 'transit') {
    await go(`/transit/routes/${routeRecord.id}/edit`);
    await page.getByLabel('Route color', { exact: true }).fill('#123456');
    await page.getByRole('button', { name: 'Suggest unused color', exact: true }).click();
    await page.getByRole('button', { name: 'Use suggested color', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Route color', { exact: true }).inputValue(), '#123456');
    await page.getByRole('button', { name: 'Use suggested color', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForURL(`**/transit/routes/${routeRecord.id}`);
    assert.equal(routeRecord.routeColorHex, '#006B67'); checks.push('Unused color suggestion preserves Admin choice until explicitly selected and saved');
    await page.getByRole('link', { name: 'New direction', exact: true }).click();
    await page.getByLabel('Direction name', { exact: true }).fill('Southbound');
    await page.getByLabel('Origin', { exact: true }).fill('Colon'); await page.getByLabel('Destination', { exact: true }).fill('Bulacao');
    await page.getByLabel('GeoJSON LineString', { exact: true }).fill(JSON.stringify({ type: 'Feature', properties: {}, geometry: direction.geometry }));
    await page.getByRole('button', { name: 'Create direction', exact: true }).click(); await page.waitForURL(`**/transit/routes/${routeRecord.id}`);
    await page.getByRole('cell', { name: 'Southbound', exact: true }).waitFor();
    checks.push('Direction creation from validated GeoJSON persists in canonical route re-read');
    await go(`/transit/directions/${direction.id}/edit`);
    await page.getByLabel('Route corridor (metres)').fill('150'); await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.getByText(/42 affected jeepneys/).waitFor();
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForURL(`**/transit/routes/${routeRecord.id}`);
    await go(`/transit/directions/${direction.id}/edit`); assert.equal(await page.getByLabel('Route corridor (metres)').inputValue(), '150');
    checks.push('Corridor impact confirmation and synthetic persistence after fresh read');
    await go(`/transit/directions/${direction.id}/geometry`); await page.getByText(/Geometry canvas only/).waitFor();
    await page.locator('canvas').waitFor(); checks.push('MapLibre geometry canvas initializes');
  } else if (mode === 'gps') {
    await go(`/applications/gps/${gps.id}`);
    await page.getByRole('button', { name: 'Approve installation', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByLabel('Installation date and time').fill('2026-11-02T09:30');
    await page.getByRole('button', { name: 'Schedule installation', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.getByRole('button', { name: 'Mark installed', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Mark installed', exact: true }).click();
    await page.getByLabel('IMEI', { exact: true }).fill('860000000000001'); await page.getByLabel('Serial number', { exact: true }).fill('SYNTHETIC-ONLY'); await page.getByLabel('Traccar unique ID', { exact: true }).fill('synthetic-device-only');
    await page.getByRole('button', { name: 'Map device', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Map device', exact: true }).click();
    await page.getByText('Saved mapping from the application API.', { exact: false }).waitFor();
    await page.reload(); await page.getByText('Saved mapping from the application API.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Map device', exact: true }).count(), 0);
    checks.push('Approve/schedule/install/map with read-after-write and fresh-visit mapping restoration');
  } else if (mode === 'summary') {
    await go('/system/reports/operations'); await page.getByRole('button', { name: 'Export counts CSV', exact: true }).waitFor();
    await page.getByText('Injected test repository — database not measured', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, 'summary-report-1440.png'), fullPage: true, animations: 'disabled' });
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export counts CSV', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'valryde-operational-counts.csv'); checks.push('Counts CSV and component-specific health labels');
    await go(`/fleet/groups/${group.id}`); await page.getByText(driver.displayName, { exact: true }).waitFor(); checks.push('G2 group membership rendered');
  } else if (mode === 'identity') {
    await go(`/identity/users/${commuter.id}`); await page.getByRole('heading', { name: commuter.displayName, exact: true }).waitFor();
    await page.evaluate(pathname => { history.pushState(null, '', pathname); dispatchEvent(new PopStateEvent('popstate')); }, `/identity/users/${admin.id}`);
    await page.getByRole('heading', { name: admin.displayName, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Disable account', exact: false }).count(), 0);
    checks.push('SPA account-route reuse loads the new identity and preserves self-disable guard');
  } else {
    await go('/tracking/live'); await page.getByRole('heading', { name: 'Tracking gateway is not configured', exact: true }).waitFor();
    await go('/tracking/deviations'); await page.getByRole('heading', { name: 'Tracking gateway is not configured', exact: true }).waitFor();
    checks.push('Tracking and deviation routes default unavailable with no synthetic telemetry');
  }
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.waitForFunction(() => {
      const drawer = document.getElementById('app-navigation');
      const content = document.querySelector('mat-sidenav-content');
      return innerWidth >= 960 || (!!drawer && !!content && drawer.getBoundingClientRect().right <= 1 &&
        Math.abs(parseFloat(getComputedStyle(content).marginLeft)) < 1);
    });
    await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true, animations: 'disabled' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
  }
  // Shared account regression: actual forms/dialogs, synthetic transport only.
  await go(`/identity/users/${commuter.id}`); await page.getByRole('button', { name: 'Disable account', exact: false }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disable account', exact: true }).click();
  await page.getByRole('button', { name: 'Enable account', exact: false }).waitFor();
  await go(`/identity/users/${admin.id}`); assert.equal(await page.getByRole('button', { name: 'Disable account', exact: false }).count(), 0);
  checks.push('Commuter status confirmation and Admin self-disable guard');
  const nonAdminContext = await browser.newContext(); await mock(nonAdminContext);
  const deniedPage = await nonAdminContext.newPage();
  await deniedPage.goto(origin + '/sign-in');
  await deniedPage.getByLabel('Email', { exact: true }).fill(commuter.email);
  await deniedPage.getByLabel('Password', { exact: true }).fill('synthetic-browser-input-only');
  await deniedPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await deniedPage.getByRole('alert').filter({ hasText: 'This account does not have Administrator access to Valryde Admin.' }).waitFor();
  assert.equal(await deniedPage.evaluate(() => sessionStorage.length), 0);
  checks.push('Synthetic authenticated non-Admin sign-in is rejected without storing a session');
  await nonAdminContext.close();
  assert.deepEqual(pageErrors, []);
  const report = { mode, state: 'PASS', evidence: 'SYNTHETIC_BROWSER_ONLY', sourceHead, sourceDirty, checks, pageErrors, requests: logs };
  fs.writeFileSync(path.join(evidence, `${mode}-report.json`), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, requests: undefined }, null, 2));
})().catch(error => { console.error('SYNTHETIC_BROWSER_FAILED:', error.message); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
});
