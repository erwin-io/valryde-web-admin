/** Real, isolated development API checks. Never prints credentials, tokens or response bodies.
 * Requires an already seeded Agent A fixture database. Does not seed, migrate or start the API.
 */
const results = [];
const unauthenticatedOnly = process.argv.includes('--unauthenticated');
const base = process.env.VALRYDE_E2E_API_URL ?? (unauthenticatedOnly ? 'http://127.0.0.1:3000' : undefined);
const password = process.env.VALRYDE_E2E_PASSWORD;
const adminEmail = process.env.VALRYDE_E2E_ADMIN_EMAIL ?? 'dev.admin@valryde.test';
const commuterEmail = process.env.VALRYDE_E2E_COMMUTER_EMAIL ?? 'dev.commuter@valryde.test';
const sessions = [];
const coverageBlocked = [];
function report(state, reason) {
  console.log(JSON.stringify({ suite: 'real-admin-api-acceptance', state, reason, results }, null, 2));
}
if (!base || (!password && !unauthenticatedOnly)) {
  report('BLOCKED', 'Set VALRYDE_E2E_API_URL and temporary VALRYDE_E2E_PASSWORD for an already seeded isolated development API. No tests ran.');
  process.exit(2);
}
let url;
try { url = new URL(base); } catch {
  report('BLOCKED', 'VALRYDE_E2E_API_URL must be a valid loopback URL.'); process.exit(2);
}
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password ||
    !['http:', 'https:'].includes(url.protocol) || !adminEmail.endsWith('@valryde.test') || !commuterEmail.endsWith('@valryde.test')) {
  report('BLOCKED', 'This runner is restricted to loopback and approved development fixture accounts.');
  process.exit(2);
}
const root = base.replace(/\/$/, '');
async function call(path, token, body, method = 'GET') {
  const response = await fetch(root + path, { method, signal: AbortSignal.timeout(10000), headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* Report status only; no upstream body output. */ }
  return { status: response.status, data };
}
async function check(name, path, expected, token, body, method) {
  const result = await call(path, token, body, method);
  results.push({ name, httpStatus: result.status, result: result.status === expected ? 'PASS' : 'FAIL' });
  if (result.status !== expected) throw new Error('Unexpected response status');
  return result.data;
}
try {
  const health = await check('Real API/application database ready', '/api/health', 200);
  if (health.database !== 'ok') throw new Error('Real application database readiness required');
  if (unauthenticatedOnly) {
    for (const path of ['/api/operators', '/api/drivers', '/api/admin/users/', '/api/admin/transit-routes',
      '/api/admin/gps-setup-requests/00000000-0000-4000-8000-000000000001/device-mapping']) {
      await check(`Unauthenticated denied: ${path}`, path, 401);
    }
    report('PARTIAL_PASS', 'Read-only health and unauthenticated boundaries only. No authenticated test, fixture write, browser or checklist completion claimed.');
  } else {
  const admin = await check('Admin fixture ordinary login', '/api/auth/login', 200, null, { email: adminEmail, password }, 'POST');
  sessions.push(admin.refreshToken);
  if (!admin.user?.roles.includes('ADMIN')) throw new Error('Invalid fixture role');
  const commuter = await check('Commuter fixture ordinary login', '/api/auth/login', 200, null, { email: commuterEmail, password }, 'POST');
  sessions.push(commuter.refreshToken);
  if (!commuter.user?.roles.includes('COMMUTER') || commuter.user.roles.includes('ADMIN')) throw new Error('Invalid fixture role');
  for (const path of ['/api/operators', '/api/drivers', '/api/admin/users/', '/api/admin/transit-routes']) {
    await check(`Unauthenticated denied: ${path}`, path, 401);
    await check(`Commuter denied: ${path}`, path, 403, commuter.accessToken);
    await check(`Admin allowed: ${path}`, path, 200, admin.accessToken);
  }
  const operators = await check('G1 directory server pagination', '/api/operators?page=1&pageSize=1', 200, admin.accessToken);
  if (!operators.pagination || !Number.isInteger(operators.pagination.total)) throw new Error('Invalid pagination contract');
  await check('G1 unassociated Driver filter', '/api/drivers?associated=false&page=1&pageSize=1', 200, admin.accessToken);
  const groups = await check('Permitted groups', '/api/fleet-groups', 200, admin.accessToken);
  if (groups.groups[0]) await check('G2 member read', `/api/fleet-groups/${groups.groups[0].id}/members?page=1&pageSize=20`, 200, admin.accessToken);
  else coverageBlocked.push('No group fixture');
  const routes = await check('Persisted canonical route/direction records', '/api/admin/transit-routes', 200, admin.accessToken);
  const direction = routes.routes.flatMap(r => r.directions)[0];
  if (direction) await check('G11 safe assignment-impact preview', `/api/admin/route-directions/${direction.id}/assignment-impact?page=1&pageSize=20`, 200, admin.accessToken);
  else coverageBlocked.push('No direction fixture');
  const requests = await check('GPS installation states', '/api/gps-setup-requests', 200, admin.accessToken);
  if (requests.requests[0]) {
    const path = `/api/admin/gps-setup-requests/${requests.requests[0].id}/device-mapping`;
    await check('G10 saved mapping read', path, 200, admin.accessToken);
    await check('G10 non-Admin denied', path, 403, commuter.accessToken);
    await check('Non-Admin GPS lifecycle denied', `/api/admin/gps-setup-requests/${requests.requests[0].id}/status`, 403,
      commuter.accessToken, { status: 'REJECTED', rejectedReason: 'Negative fixture authorization test' }, 'PATCH');
  }
  else coverageBlocked.push('No GPS request fixture');
  // Negative mutations are expected to be rejected and never change fixture data.
  await check('Admin cannot disable own account', `/api/admin/users/${admin.user.id}/status`, 400,
    admin.accessToken, { status: 'DISABLED' }, 'PATCH');
  await check('Commuter cannot administer accounts', `/api/admin/users/${admin.user.id}/status`, 403,
    commuter.accessToken, { status: 'ACTIVE' }, 'PATCH');
  if (direction) {
    await check('Invalid corridor rejected', `/api/admin/route-directions/${direction.id}`, 400,
      admin.accessToken, { corridorM: 0 }, 'PATCH');
    await check('Non-Admin canonical edit denied', `/api/admin/route-directions/${direction.id}`, 403,
      commuter.accessToken, { corridorM: direction.corridorM }, 'PATCH');
    await check('Invalid geometry rejected', `/api/admin/route-directions/${direction.id}`, 400,
      admin.accessToken, { geometry: { type: 'Point', coordinates: [123.8, 10.3] } }, 'PATCH');
  }
  const duplicateRoute = routes.routes.find(route => route.directions.length >= 2);
  if (duplicateRoute) await check('D3 duplicate direction label returns conflict', `/api/admin/route-directions/${duplicateRoute.directions[0].id}`, 409,
    admin.accessToken, { directionLabel: duplicateRoute.directions[1].directionLabel }, 'PATCH');
  else coverageBlocked.push('No two-direction route for D3');
  const rotated = await check('Admin refresh rotates normally', '/api/auth/refresh', 200, null,
    { refreshToken: admin.refreshToken }, 'POST');
  sessions.push(rotated.refreshToken);
  if (rotated.refreshToken === admin.refreshToken) throw new Error('Rotation did not replace token');
  await check('Authenticated use after refresh', '/api/admin/users/', 200, rotated.accessToken);
  await check('Logout revokes rotated session', '/api/auth/logout', 204, null, { refreshToken: rotated.refreshToken }, 'POST');
  await check('Logged-out refresh rejected', '/api/auth/refresh', 401, null, { refreshToken: rotated.refreshToken }, 'POST');
  await check('Old refresh rejected', '/api/auth/refresh', 401, null, { refreshToken: admin.refreshToken }, 'POST');
  for (const reason of coverageBlocked) results.push({ name: reason, result: 'BLOCKED' });
  report(coverageBlocked.length ? 'INCOMPLETE' : 'PASS', 'Only listed authenticated API checks ran. This does not claim browser persistence, positive lifecycle, hardware or Tech Lead acceptance.');
  if (coverageBlocked.length) process.exitCode = 2;
  }
} catch {
  report('FAILED', 'API unavailable, fixture/login mismatch or contract assertion failed. Inspect only sanitized check names/statuses above.');
  process.exitCode = 1;
} finally {
  for (const refreshToken of sessions) {
    try { await call('/api/auth/logout', null, { refreshToken }, 'POST'); } catch { /* Do not expose secrets on cleanup failure. */ }
  }
}
