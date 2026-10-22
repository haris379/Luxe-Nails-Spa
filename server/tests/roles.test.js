// Role-based permissions: business admin vs developer. No database needed (the admin lookup is stubbed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'x'.repeat(40);
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `luxe-roles-unit-${process.pid}`);
const { createApp } = await import('../src/app.js');
const { adminStore } = await import('../src/middleware/auth.js');
const { default: routes } = await import('../src/routes/index.js');
const { PERMISSIONS, can, permissionsFor, isRole } = await import('../src/config/permissions.js');
const { SERVICE_DIR, UPLOAD_ROOT } = await import('../src/utils/uploads.js');
const app = createApp();

const ID = { biz: 'b'.repeat(24), dev: 'd'.repeat(24), legacy: 'a'.repeat(24), junk: 'f'.repeat(24) };
const DB = {
  [ID.biz]: { role: 'admin' },
  [ID.dev]: { role: 'developer' },
  [ID.legacy]: {}, // account created before roles existed: no role field
  [ID.junk]: { role: 'superuser' },
};
adminStore.findById = async (id) => (DB[id] ? { _id: id, email: `${id.slice(0, 3)}@x.com`, tokenVersion: 0, ...DB[id] } : null);

const token = (id, claimRole = 'admin') => jwt.sign({ sub: id, role: claimRole, email: 'x@x.com', tv: 0 }, process.env.JWT_SECRET);
const as = (id, claimRole) => ({ Authorization: `Bearer ${token(id, claimRole)}` });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const svcFields = { name: 'Sneaky Service', description: 'Should never be created', price: '10', durationMinutes: '30', category: 'nail-services' };
const ANY_ID = 'c'.repeat(24);

test.after(async () => { await fs.rm(UPLOAD_ROOT, { recursive: true, force: true }); });

// ---------------- the permission map ----------------
test('permission map: business admin cannot write services; developer cannot see customer data', () => {
  assert.deepEqual(PERMISSIONS.admin, ['services:read', 'appointments:read', 'appointments:manage', 'messages:read', 'messages:manage']);
  assert.deepEqual(PERMISSIONS.developer, ['services:read', 'services:write']);
  assert.equal(can('admin', 'services:write'), false);
  assert.equal(can('admin', 'services:read'), true);
  assert.equal(can('developer', 'services:write'), true);
  assert.equal(can('developer', 'appointments:read'), false);
  assert.equal(can('developer', 'messages:read'), false);
  for (const bad of [undefined, null, '', 'owner', 'superuser', '__proto__', 'constructor']) {
    assert.equal(can(bad, 'services:write'), false, String(bad));
    assert.equal(isRole(bad), false, String(bad));
    assert.deepEqual(permissionsFor(bad), []);
  }
  const copy = permissionsFor('admin'); copy.push('services:write');
  assert.equal(can('admin', 'services:write'), false, 'callers cannot mutate the map');
});

// ---------------- every admin endpoint is guarded ----------------
const adminRoutes = routes.stack
  .filter((l) => l.route && l.route.path.startsWith('/admin') && l.route.path !== '/admin/login')
  .map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods), handlers: l.route.stack.map((s) => s.handle) }));

test('every admin route declares a permission (only /me and /logout are open to both roles)', () => {
  assert.ok(adminRoutes.length >= 11, `found ${adminRoutes.length}`);
  for (const r of adminRoutes) {
    const perm = r.handlers.find((h) => h.permission)?.permission;
    if (['/admin/me', '/admin/logout'].includes(r.path)) continue;
    assert.ok(perm, `${r.methods} ${r.path} has no permission guard`);
  }
});

test('service create / edit / delete require services:write, and the check runs before the upload is parsed', () => {
  for (const [method, p] of [['post', '/admin/services'], ['put', '/admin/services/:id'], ['delete', '/admin/services/:id']]) {
    const r = adminRoutes.find((x) => x.path === p && x.methods.includes(method));
    assert.ok(r, `${method} ${p} exists`);
    assert.equal(r.handlers.find((h) => h.permission)?.permission, 'services:write');
    const guardAt = r.handlers.findIndex((h) => h.permission);
    const multerAt = r.handlers.findIndex((h) => h.name === 'multerMiddleware');
    if (multerAt !== -1) assert.ok(guardAt < multerAt, `${method} ${p}: permission check must precede multer`);
  }
});

test('reading services needs only services:read; appointments and messages map to their own permissions', () => {
  const need = (m, p) => adminRoutes.find((x) => x.path === p && x.methods.includes(m)).handlers.find((h) => h.permission).permission;
  assert.equal(need('get', '/admin/services'), 'services:read');
  assert.equal(need('get', '/admin/appointments'), 'appointments:read');
  assert.equal(need('patch', '/admin/appointments/:id/status'), 'appointments:manage');
  assert.equal(need('post', '/admin/appointments/:id/resend-email'), 'appointments:manage');
  assert.equal(need('get', '/admin/messages'), 'messages:read');
  assert.equal(need('patch', '/admin/messages/:id/read'), 'messages:manage');
});

// ---------------- unauthenticated ----------------
test('no token: every service write is 401', async () => {
  for (const [method, url] of [['post', '/api/admin/services'], ['put', `/api/admin/services/${ANY_ID}`], ['delete', `/api/admin/services/${ANY_ID}`]]) {
    assert.equal((await request(app)[method](url).send({})).status, 401, `${method} ${url}`);
  }
});

// ---------------- business admin: blocked from service changes, however it asks ----------------
test('business admin: create / edit / delete a service are 403 FORBIDDEN', async () => {
  const create = await request(app).post('/api/admin/services').set(as(ID.biz)).send({ ...svcFields, price: 10, durationMinutes: 30 });
  const edit = await request(app).put(`/api/admin/services/${ANY_ID}`).set(as(ID.biz)).send({ ...svcFields, price: 10, durationMinutes: 30 });
  const del = await request(app).delete(`/api/admin/services/${ANY_ID}`).set(as(ID.biz));
  for (const res of [create, edit, del]) {
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN');
  }
});

test('business admin: an image upload is refused before it is read, and nothing reaches the disk', async () => {
  let r = request(app).post('/api/admin/services').set(as(ID.biz));
  for (const [k, v] of Object.entries(svcFields)) r = r.field(k, v);
  const res = await r.attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(res.status, 403);
  assert.deepEqual(await fs.readdir(SERVICE_DIR).catch(() => []), []);
  // an oversized upload gets 403 too (not 413), proving the body was never parsed
  const big = await request(app).put(`/api/admin/services/${ANY_ID}`).set(as(ID.biz)).field('name', 'x').attach('imageFile', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), { filename: 'big.png', contentType: 'image/png' });
  assert.equal(big.status, 403);
});

test('business admin cannot talk their way into developer rights (body, headers, query, token claims)', async () => {
  const attempts = [
    (r) => r.send({ ...svcFields, price: 10, durationMinutes: 30, role: 'developer', permissions: ['services:write'], isDeveloper: true }),
    (r) => r.set('X-Role', 'developer').set('X-Admin-Role', 'developer').set('X-Permissions', 'services:write').send({}),
    (r) => r.query({ role: 'developer', permissions: 'services:write' }).send({}),
    (r) => r.set('Cookie', 'role=developer; isDeveloper=true').send({}),
  ];
  for (const apply of attempts) {
    const res = await apply(request(app).post('/api/admin/services').set(as(ID.biz)));
    assert.equal(res.status, 403);
  }
  // a (validly signed) token that CLAIMS developer is still judged by the database role
  const claimed = await request(app).post('/api/admin/services').set(as(ID.biz, 'developer')).send({});
  assert.equal(claimed.status, 403);
  assert.equal((await request(app).delete(`/api/admin/services/${ANY_ID}`).set(as(ID.legacy, 'developer'))).status, 403);
});

test('there is no endpoint to register, promote or change a role', async () => {
  for (const [method, url] of [['post', '/api/admin/register'], ['post', '/api/admin/users'], ['put', '/api/admin/role'], ['patch', '/api/admin/me'], ['post', '/api/admin/promote'], ['put', '/api/admin/users/123'], ['post', '/api/register'], ['post', '/api/users'], ['post', '/api/auth/register']]) {
    const signedIn = await request(app)[method](url).set(as(ID.biz)).send({ email: 'me@x.com', password: 'a-long-password', role: 'developer' });
    assert.equal(signedIn.status, 404, `${method} ${url} should not exist`);
    const anon = await request(app)[method](url).send({ role: 'developer' });
    assert.ok([401, 404].includes(anon.status), `${method} ${url} anonymous -> ${anon.status}`);
  }
});

// ---------------- business admin keeps its existing powers ----------------
test('business admin passes the guard for appointments and messages', async () => {
  // 400 = the guard let the request through and validation (not permission) rejected it; no database needed
  assert.equal((await request(app).get('/api/admin/appointments?status=bogus').set(as(ID.biz))).status, 400);
  assert.equal((await request(app).patch(`/api/admin/appointments/${ANY_ID}/status`).set(as(ID.biz)).send({ status: 'bogus' })).status, 400);
  assert.equal((await request(app).patch('/api/admin/messages/not-an-id/read').set(as(ID.biz))).status, 400);
  assert.equal((await request(app).post('/api/admin/appointments/not-an-id/resend-email').set(as(ID.biz))).status, 400);
});

test('legacy account without a role field is treated as business admin', async () => {
  const me = await request(app).get('/api/admin/me').set(as(ID.legacy));
  assert.equal(me.body.data.role, 'admin');
  assert.equal((await request(app).get('/api/admin/appointments?status=bogus').set(as(ID.legacy))).status, 400);
  assert.equal((await request(app).post('/api/admin/services').set(as(ID.legacy)).send({})).status, 403);
});

// ---------------- developer ----------------
test('developer passes the guard for service writes (validation, not permission, decides)', async () => {
  const create = await request(app).post('/api/admin/services').set(as(ID.dev, 'developer')).send({});
  assert.equal(create.status, 400);
  assert.ok(create.body.errors.name);
  assert.equal((await request(app).put(`/api/admin/services/${ANY_ID}`).set(as(ID.dev, 'developer')).send({ name: '' })).status, 400);
  assert.equal((await request(app).delete('/api/admin/services/not-an-id').set(as(ID.dev, 'developer'))).status, 400);
});

test('developer cannot read or change customer data', async () => {
  const dev = as(ID.dev, 'developer');
  for (const [method, url] of [
    ['get', '/api/admin/appointments'], ['patch', `/api/admin/appointments/${ANY_ID}/status`], ['post', `/api/admin/appointments/${ANY_ID}/resend-email`],
    ['get', '/api/admin/messages'], ['patch', `/api/admin/messages/${ANY_ID}/read`],
  ]) {
    const res = await request(app)[method](url).set(dev).send({ status: 'confirmed' });
    assert.equal(res.status, 403, `${method} ${url}`);
    assert.equal(res.body.code, 'FORBIDDEN');
  }
});

// ---------------- /me and unknown roles ----------------
test('/me reports the role and permissions derived from the database', async () => {
  const biz = (await request(app).get('/api/admin/me').set(as(ID.biz))).body.data;
  assert.equal(biz.role, 'admin');
  assert.deepEqual(biz.permissions, PERMISSIONS.admin);
  assert.ok(!biz.permissions.includes('services:write'));
  const dev = (await request(app).get('/api/admin/me').set(as(ID.dev, 'developer'))).body.data;
  assert.equal(dev.role, 'developer');
  assert.deepEqual(dev.permissions, PERMISSIONS.developer);
  // the claim in the token does not matter: a developer token on a business account still reports "admin"
  assert.equal((await request(app).get('/api/admin/me').set(as(ID.biz, 'developer'))).body.data.role, 'admin');
});

test('an unknown role in the database, or in the token, is refused (403 NOT_ADMIN)', async () => {
  const junk = await request(app).get('/api/admin/me').set(as(ID.junk, 'admin'));
  assert.equal(junk.status, 403);
  assert.equal(junk.body.code, 'NOT_ADMIN');
  for (const claim of ['customer', 'user', 'superadmin', '', undefined]) {
    const res = await request(app).get('/api/admin/me').set({ Authorization: `Bearer ${jwt.sign({ sub: ID.biz, role: claim, tv: 0 }, process.env.JWT_SECRET)}` });
    assert.equal(res.status, 403, String(claim));
    assert.equal(res.body.code, 'NOT_ADMIN');
  }
});

test('a permission failure and a failed session are different responses (so the owner is not logged out by a 403)', async () => {
  const denied = await request(app).post('/api/admin/services').set(as(ID.biz)).send({});
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'FORBIDDEN');
  const expired = await request(app).get('/api/admin/me').set({ Authorization: `Bearer ${jwt.sign({ sub: ID.biz, role: 'admin', tv: 0 }, process.env.JWT_SECRET, { expiresIn: -5 })}` });
  assert.equal(expired.status, 401);
});
