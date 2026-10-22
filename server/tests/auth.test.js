// Admin authentication / authorization tests (no database needed: the admin lookup is stubbed).
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'x'.repeat(40);
const { createApp } = await import('../src/createApp.js');
const { adminStore } = await import('../src/middleware/auth.js');
const { default: routes } = await import('../src/routes/index.js');
const app = createApp();

const ID = 'b'.repeat(24);
let record; // what "the database" currently holds for this admin
let bumps;
const reset = (over = {}) => { record = { _id: ID, email: 'admin@x.com', role: 'admin', tokenVersion: 0, ...over }; bumps = 0; };
adminStore.findById = async (id) => (record && id === ID ? { ...record } : null);
adminStore.bumpTokenVersion = async () => { bumps += 1; record.tokenVersion += 1; };

const sign = (claims = {}, opts = {}) =>
  jwt.sign({ sub: ID, email: 'admin@x.com', role: 'admin', tv: 0, ...claims }, process.env.JWT_SECRET, { expiresIn: '1h', ...opts });
const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('every admin-only route rejects requests without a token', async () => {
  reset();
  const adminRoutes = routes.stack
    .filter((l) => l.route && l.route.path.startsWith('/admin') && l.route.path !== '/admin/login')
    .flatMap((l) => Object.keys(l.route.methods).map((m) => [m, l.route.path]));
  assert.ok(adminRoutes.length >= 10, `found ${adminRoutes.length} admin routes`);
  for (const [method, path] of adminRoutes) {
    const url = '/api' + path.replace(':id', 'c'.repeat(24));
    const res = await request(app)[method](url);
    assert.equal(res.status, 401, `${method.toUpperCase()} ${url} should be 401 without a token`);
  }
});

test('unknown /api/admin paths do not leak (401 before 404)', async () => {
  reset();
  assert.equal((await request(app).get('/api/admin/does-not-exist')).status, 401);
});

test('a valid admin token works and /me returns the verified role', async () => {
  reset();
  const res = await request(app).get('/api/admin/me').set(auth(sign()));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'admin');
});

test('expired, forged, alg=none and malformed tokens are rejected', async () => {
  reset();
  const expired = sign({}, { expiresIn: -10 });
  const forged = jwt.sign({ sub: ID, role: 'admin', tv: 0 }, 'some-other-secret-some-other-secret!!');
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: ID, role: 'admin' })).toString('base64url')}.`;
  for (const t of [expired, forged, none, 'garbage', '']) {
    const res = await request(app).get('/api/admin/me').set(auth(t));
    assert.equal(res.status, 401, `token ${String(t).slice(0, 12)}…`);
  }
});

test('a customer-style token (role claim not admin) is forbidden', async () => {
  reset();
  assert.equal((await request(app).get('/api/admin/me').set(auth(sign({ role: 'customer' })))).status, 403);
  assert.equal((await request(app).get('/api/admin/appointments').set(auth(sign({ role: 'user' })))).status, 403);
});

test('claiming admin is not enough: the database role is checked too', async () => {
  reset({ role: 'staff' });
  assert.equal((await request(app).get('/api/admin/me').set(auth(sign()))).status, 403);
});

test('a token for a deleted admin stops working', async () => {
  reset();
  record = null;
  assert.equal((await request(app).get('/api/admin/me').set(auth(sign()))).status, 401);
});

test('a token whose subject is not a valid id is rejected', async () => {
  reset();
  assert.equal((await request(app).get('/api/admin/me').set(auth(sign({ sub: '1' })))).status, 401);
  assert.equal((await request(app).get('/api/admin/me').set(auth(sign({ sub: { $ne: null } })))).status, 401);
});

test('logout invalidates the token on the server', async () => {
  reset();
  const token = sign();
  assert.equal((await request(app).get('/api/admin/appointments?status=bogus').set(auth(token))).status, 400); // passes auth
  const out = await request(app).post('/api/admin/logout').set(auth(token));
  assert.equal(out.status, 200);
  assert.equal(bumps, 1);
  // The same token must now be useless everywhere.
  for (const path of ['/api/admin/me', '/api/admin/appointments', '/api/admin/services', '/api/admin/messages']) {
    const res = await request(app).get(path).set(auth(token));
    assert.equal(res.status, 401, path);
  }
  assert.equal((await request(app).post('/api/admin/logout').set(auth(token))).status, 401);
});

test('legacy tokens without a version still work until logout', async () => {
  reset();
  const legacy = jwt.sign({ sub: ID, email: 'admin@x.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await request(app).get('/api/admin/me').set(auth(legacy))).status, 200);
});

test('a database failure during the check is a 500, not a 401 or a pass', async () => {
  reset();
  const original = adminStore.findById;
  adminStore.findById = async () => { throw new Error('db down'); };
  const res = await request(app).get('/api/admin/me').set(auth(sign()));
  adminStore.findById = original;
  assert.equal(res.status, 500);
});

test('login rejects missing/invalid credentials without touching the database', async () => {
  const res = await request(app).post('/api/admin/login').send({ email: 'nope', password: '' });
  assert.equal(res.status, 400);
});
