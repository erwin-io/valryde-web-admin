/** Real G1 acceptance against the approved isolated development API. No fixture writes/seeding.
 * Credentials are read only from the current process. Output never contains bodies or tokens.
 */
import assert from 'node:assert/strict';

const results = [];
const sessions = new Set();
const base = process.env.VALRYDE_E2E_API_URL;
const password = process.env.VALRYDE_E2E_PASSWORD;
const adminEmail = process.env.VALRYDE_E2E_ADMIN_EMAIL ?? 'dev.admin@valryde.test';
const commuterEmail = process.env.VALRYDE_E2E_COMMUTER_EMAIL ?? 'dev.commuter@valryde.test';
const report = (state, reason) => console.log(JSON.stringify({
  suite: 'real-g1-directory-acceptance', evidence: 'REAL_API_ONLY', state, reason, results,
}, null, 2));
if (!base || !password) {
  report('CREDENTIALS_NOT_CONFIGURED', 'Supply VALRYDE_E2E_API_URL and VALRYDE_E2E_PASSWORD in this process. No authenticated tests ran.');
  process.exit(2);
}
let url;
try { url = new URL(base); } catch { /* fail closed below */ }
if (!url || url.origin !== 'http://127.0.0.1:3000' || url.pathname !== '/' || url.search || url.hash ||
    url.username || url.password || ![adminEmail, commuterEmail].every(v => v.endsWith('@valryde.test'))) {
  report('CONFIGURATION_REJECTED', 'Only the approved loopback API and development fixture accounts are allowed.');
  process.exit(2);
}
const root = url.origin;
async function call(path, token, method = 'GET', body) {
  const response = await fetch(root + '/api' + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000), headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data };
}
async function check(name, path, status, token, method, body, validate = () => {}) {
  let result;
  try {
    result = await call(path, token, method, body);
    assert.equal(result.status, status);
    validate(result.data);
    results.push({ name, httpStatus: result.status, result: 'PASS' });
    return result.data;
  } catch {
    results.push({ name, ...(result ? { httpStatus: result.status } : {}), result: 'FAIL' });
    throw new Error('Sanitized acceptance failure');
  }
}
async function login(name, email, role) {
  const response = await check(name, '/auth/login', 200, null, 'POST', { email, password }, body => {
    assert(body.user.roles.includes(role)); assert.equal(typeof body.accessToken, 'string');
    assert.equal(typeof body.refreshToken, 'string');
  });
  sessions.add(response.refreshToken);
  return response;
}
function page(body, key, expectedPage, size) {
  assert(Array.isArray(body[key])); assert(body[key].length <= size);
  const p = body.pagination;
  assert.equal(p.page, expectedPage); assert.equal(p.pageSize, size);
  assert(Number.isInteger(p.total) && p.total >= body[key].length);
  assert.equal(p.totalPages, Math.ceil(p.total / size));
}
const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await check('Real API and application database ready', '/health', 200, null, 'GET', undefined,
    b => assert.equal(b.database, 'ok'));
  const admin = await login('Normal ADMIN fixture login', adminEmail, 'ADMIN');
  const commuter = await login('Normal COMMUTER fixture login', commuterEmail, 'COMMUTER');
  const driver = await login('Normal DRIVER fixture login', 'dev.driver-a@valryde.test', 'DRIVER');
  const operatorA = await login('Normal Operator A fixture login', 'dev.operator-a@valryde.test', 'OPERATOR');
  const operatorB = await login('Normal Operator B fixture login', 'dev.operator-b@valryde.test', 'OPERATOR');
  for (const path of ['/operators', '/drivers']) {
    await check(`Unauthenticated denied ${path}`, path, 401);
    for (const [name, caller] of [['COMMUTER', commuter], ['DRIVER', driver]]) {
      await check(`${name} denied ${path}`, path, 403, caller.accessToken);
    }
  }
  await check('OPERATOR denied global Operator directory', '/operators', 403, operatorA.accessToken);
  const users = await check('ADMIN reads public account identities', '/admin/users/', 200, admin.accessToken);
  const operators = await check('ADMIN global Operator page and envelope', '/operators?page=1&pageSize=100', 200,
    admin.accessToken, 'GET', undefined, b => page(b, 'operators', 1, 100));
  const drivers = await check('ADMIN global Driver page and envelope', '/drivers?page=1&pageSize=100', 200,
    admin.accessToken, 'GET', undefined, b => page(b, 'drivers', 1, 100));
  assert(operators.operators.length >= 3 && drivers.drivers.length >= 3);
  for (const [key, rows] of [['operators', operators.operators], ['drivers', drivers.drivers]]) {
    const first = await check(`${key} server page one`, `/${key}?page=1&pageSize=1`, 200, admin.accessToken,
      'GET', undefined, b => { page(b, key, 1, 1); assert.equal(b[key].length, 1); });
    await check(`${key} server page two differs from page one`, `/${key}?page=2&pageSize=1`, 200, admin.accessToken,
      'GET', undefined, b => { page(b, key, 2, 1); assert.equal(b[key].length, 1); assert.notDeepEqual(b[key], first[key]); });
    for (const status of ['ACTIVE', 'DISABLED']) {
      await check(`${key} server business status ${status}`, `/${key}?status=${status}&page=1&pageSize=100`, 200,
        admin.accessToken, 'GET', undefined, b => { page(b, key, 1, 100); assert(b[key].every(r => r.status === status)); });
    }
    await check(`${key} search matches selected identity`, `/${key}?q=${encodeURIComponent(rows[0].email)}&page=1&pageSize=100`,
      200, admin.accessToken, 'GET', undefined, b => { assert.equal(b[key].length, 1); assert.equal(b[key][0].email, rows[0].email); });
    await check(`${key} empty search is a successful empty page`, `/${key}?q=no-such-fixture-004&page=1&pageSize=20`, 200,
      admin.accessToken, 'GET', undefined, b => { page(b, key, 1, 20); assert.equal(b.pagination.total, 0); });
    await check(`${key} invalid pagination rejected`, `/${key}?pageSize=101`, 400, admin.accessToken);
  }
  const jeepneys = await check('ADMIN permitted jeepneys', '/jeepneys', 200, admin.accessToken);
  const groups = await check('ADMIN permitted groups', '/fleet-groups', 200, admin.accessToken);
  for (const op of operators.operators) {
    const user = users.users.find(u => u.id === op.ownerUserId);
    assert(user && op.operatorId !== user.id && op.email === user.email && op.userStatus === user.status);
    assert.equal(op.driverCount, drivers.drivers.filter(d => d.operatorId === op.operatorId).length);
    assert.equal(op.jeepneyCount, jeepneys.jeepneys.filter(j => j.operatorId === op.operatorId).length);
    assert.equal(op.groupCount, groups.groups.filter(g => g.operatorId === op.operatorId).length);
  }
  for (const d of drivers.drivers) {
    const user = users.users.find(u => u.id === d.userId);
    assert(user && d.driverId !== user.id && d.email === user.email && d.userStatus === user.status);
    assert(d.activeJeepneyId === null || jeepneys.jeepneys.some(j => j.id === d.activeJeepneyId && j.operatorId === d.operatorId));
    for (const groupId of d.groupIds) assert(groups.groups.some(g => g.id === groupId && g.operatorId === d.operatorId));
  }
  results.push({ name: 'Business/account identity, ownership, counts, assignments and group references agree', result: 'PASS' });
  const active = drivers.drivers.find(d => d.driverId === id('d3', 1));
  assert(active && active.activeJeepneyId === id('d6', 1) && active.groupIds.includes(id('d7', 1)));
  for (const associated of [true, false]) {
    await check(`ADMIN association filter ${associated}`, `/drivers?associated=${associated}&page=1&pageSize=100`, 200,
      admin.accessToken, 'GET', undefined, b => { page(b, 'drivers', 1, 100); assert(b.drivers.every(d => (d.operatorId !== null) === associated)); });
  }
  for (const [label, session, operatorId] of [['A', operatorA, id('d2', 1)], ['B', operatorB, id('d2', 2)]]) {
    await check(`ADMIN filters Operator ${label}`, `/drivers?operatorId=${operatorId}&page=1&pageSize=100`, 200,
      admin.accessToken, 'GET', undefined, b => { assert(b.drivers.length > 0); assert(b.drivers.every(d => d.operatorId === operatorId)); });
    await check(`Operator ${label} sees only owned Drivers`, '/drivers?page=1&pageSize=100', 200, session.accessToken,
      'GET', undefined, b => { assert(b.drivers.length > 0); assert(b.drivers.every(d => d.operatorId === operatorId)); });
    await check(`Operator ${label} cannot use ADMIN ownership filter`, `/drivers?operatorId=${operatorId}`, 403, session.accessToken);
    await check(`Operator ${label} cannot use ADMIN association filter`, '/drivers?associated=false', 403, session.accessToken);
  }
  await check('Cross-operator Driver assignment denied', `/jeepneys/${id('d6', 1)}/driver-assignment`, 403,
    operatorA.accessToken, 'POST', { driverId: id('d3', 2) });
  await check('Conflicting group route membership rejected', `/fleet-groups/${id('d7', 2)}/jeepneys`, 409,
    operatorA.accessToken, 'POST', { jeepneyId: id('d6', 4) });
  await check('Operator fleet list excludes other tenant', '/jeepneys', 200, operatorA.accessToken, 'GET', undefined,
    b => assert(b.jeepneys.every(j => j.operatorId === id('d2', 1))));
  await check('Driver fleet list excludes other tenant', '/jeepneys', 200, driver.accessToken, 'GET', undefined,
    b => assert(!b.jeepneys.some(j => j.id === id('d6', 5))));
  const rotated = await check('ADMIN refresh rotates session', '/auth/refresh', 200, null, 'POST',
    { refreshToken: admin.refreshToken }, b => assert.notEqual(b.refreshToken, admin.refreshToken));
  sessions.add(rotated.refreshToken);
  await check('Directory accessible after refresh', '/operators', 200, rotated.accessToken);
  await check('Logout newest session', '/auth/logout', 204, null, 'POST', { refreshToken: rotated.refreshToken });
  await check('Logged-out refresh denied', '/auth/refresh', 401, null, 'POST', { refreshToken: rotated.refreshToken });
  report('PASS', 'Only listed real API checks passed. Browser, positive account lifecycle and Tech Lead acceptance are separate gates.');
} catch {
  report('FAILED', 'A request or contract/fixture assertion failed. No response body, password or token is logged.');
  process.exitCode = 1;
} finally {
  for (const refreshToken of sessions) {
    try { await call('/auth/logout', null, 'POST', { refreshToken }); } catch { /* No secret output. */ }
  }
}
