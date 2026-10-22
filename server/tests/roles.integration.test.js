// Business admin vs developer, end to end against a real database, using real logins and real provisioning.
// Run: MONGODB_TEST_URI=mongodb://127.0.0.1:27017/luxe-nails-test npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { skip, connect, disconnect, reset, app, Admin, Appointment, Service, uri, futureDate } from './helpers/db.js';
import { ContactMessage } from '../src/models/ContactMessage.js';
import { provisionDeveloper } from '../src/utils/provision.js';
import { SERVICE_DIR, UPLOAD_ROOT } from '../src/utils/uploads.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const OWNER = { email: 'owner@luxenails.test', password: 'owner-password-123' };
const DEV = { email: 'dev@maintainer.test', password: 'a-long-developer-passphrase' };
const fields = { name: 'New Service', description: 'Added by the developer', price: '500', durationMinutes: '60', category: 'facial' };

let owner; // { token, auth }
let dev;
let svc; // an existing service
const login = async ({ email, password }, extra = {}) => {
  const res = await request(app).post('/api/admin/login').send({ email, password, ...extra });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { token: res.body.data.token, auth: { Authorization: `Bearer ${res.body.data.token}` }, body: res.body.data };
};
const files = async () => (await fs.readdir(SERVICE_DIR).catch(() => [])).sort();

const t = (name, fn) => test(name, { skip }, async () => {
  await reset();
  await Service.deleteMany({});
  await ContactMessage.deleteMany({});
  await fs.rm(SERVICE_DIR, { recursive: true, force: true });
  await Admin.create({ email: OWNER.email, passwordHash: await bcrypt.hash(OWNER.password, 10), role: 'admin' });
  await provisionDeveloper(DEV.email, DEV.password);
  svc = await Service.create({ name: 'Classic Manicure', description: 'Original description', price: 350, durationMinutes: 45, category: 'nail-services', image: '/images/service-manicure.svg' });
  await Service.create({ name: 'Hidden Service', description: 'Inactive one', price: 100, durationMinutes: 30, category: 'body', active: false });
  owner = await login(OWNER);
  dev = await login(DEV);
  await fn();
});

test('setup', { skip }, async () => { await connect(); });

// ---------------- logins ----------------
t('logins report the role and permissions; a role sent in the request is ignored', async () => {
  assert.equal(owner.body.role, 'admin');
  assert.ok(!owner.body.permissions.includes('services:write'));
  assert.equal(dev.body.role, 'developer');
  assert.deepEqual(dev.body.permissions, ['services:read', 'services:write']);
  const sneaky = await login(OWNER, { role: 'developer', permissions: ['services:write'], isDeveloper: true });
  assert.equal(sneaky.body.role, 'admin');
  assert.equal((await Admin.findOne({ email: OWNER.email })).role, 'admin');
  const me = await request(app).get('/api/admin/me').set(sneaky.auth);
  assert.equal(me.body.data.role, 'admin');
});

// ---------------- business admin: read only on services ----------------
t('business admin can view every service (including inactive) with details and image', async () => {
  const res = await request(app).get('/api/admin/services').set(owner.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  const mani = res.body.data.find((s) => s.name === 'Classic Manicure');
  assert.equal(mani.price, 350);
  assert.equal(mani.image, '/images/service-manicure.svg');
  assert.equal(mani.description, 'Original description');
  assert.ok(res.body.data.some((s) => s.active === false));
});

t('business admin cannot create, edit or delete a service through the API, and nothing changes', async () => {
  const before = JSON.stringify(await Service.find().sort({ name: 1 }).lean());
  const asJson = await request(app).post('/api/admin/services').set(owner.auth).send({ ...fields, price: 500, durationMinutes: 60 });
  let up = request(app).post('/api/admin/services').set(owner.auth);
  for (const [k, v] of Object.entries(fields)) up = up.field(k, v);
  const withFile = await up.attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' });
  const price = await request(app).put(`/api/admin/services/${svc._id}`).set(owner.auth).send({ ...fields, name: 'Classic Manicure', price: 1, durationMinutes: 45 });
  const deactivate = await request(app).put(`/api/admin/services/${svc._id}`).set(owner.auth).send({ name: 'Classic Manicure', description: 'x'.repeat(10), price: 350, durationMinutes: 45, category: 'nail-services', active: false });
  const image = await request(app).put(`/api/admin/services/${svc._id}`).set(owner.auth).field('name', 'Classic Manicure').attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' });
  const del = await request(app).delete(`/api/admin/services/${svc._id}`).set(owner.auth);
  for (const [what, res] of Object.entries({ asJson, withFile, price, deactivate, image, del })) {
    assert.equal(res.status, 403, what);
    assert.equal(res.body.code, 'FORBIDDEN', what);
  }
  assert.equal(JSON.stringify(await Service.find().sort({ name: 1 }).lean()), before, 'database untouched');
  assert.deepEqual(await files(), [], 'no file written');
});

t('the owner stays signed in after being refused (a 403 does not end the session)', async () => {
  await request(app).delete(`/api/admin/services/${svc._id}`).set(owner.auth);
  assert.equal((await request(app).get('/api/admin/me').set(owner.auth)).status, 200);
});

// ---------------- developer: full service management ----------------
t('developer can add, edit, replace the image of, and delete a service; the owner then sees the changes', async () => {
  let r = request(app).post('/api/admin/services').set(dev.auth);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  const created = await r.attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data._id;
  const firstImage = created.body.data.image;
  assert.match(firstImage, /^\/uploads\/services\/[a-f0-9]{32}\.png$/);

  const edited = await request(app).put(`/api/admin/services/${id}`).set(dev.auth).field('name', 'New Service').field('description', 'Updated description text').field('price', '650').field('durationMinutes', '60').field('category', 'facial').field('image', firstImage);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.price, 650);
  assert.equal(edited.body.data.image, firstImage, 'image kept when no new file is sent');

  const replaced = await request(app).put(`/api/admin/services/${id}`).set(dev.auth).field('name', 'New Service').field('description', 'Updated description text').field('price', '650').field('durationMinutes', '60').field('category', 'facial').attach('imageFile', PNG, { filename: 'b.png', contentType: 'image/png' });
  assert.equal(replaced.status, 200);
  assert.notEqual(replaced.body.data.image, firstImage);
  assert.equal((await files()).length, 1, 'old image removed after the update');

  const seen = await request(app).get('/api/admin/services').set(owner.auth);
  const mine = seen.body.data.find((s) => s._id === id);
  assert.equal(mine.price, 650);
  assert.equal(mine.image, replaced.body.data.image);
  const pub = await request(app).get('/api/services');
  assert.ok(pub.body.data.some((s) => s._id === id), 'customers see it');

  assert.equal((await request(app).delete(`/api/admin/services/${id}`).set(dev.auth)).status, 200);
  assert.deepEqual(await files(), []);
  assert.equal((await request(app).get('/api/admin/services').set(owner.auth)).body.data.some((s) => s._id === id), false);
});

t('developer can also read the service list (and edit an existing, manually-pathed service)', async () => {
  assert.equal((await request(app).get('/api/admin/services').set(dev.auth)).status, 200);
  const res = await request(app).put(`/api/admin/services/${svc._id}`).set(dev.auth).send({ name: 'Classic Manicure', description: 'Changed by developer', price: 400, durationMinutes: 45, category: 'nail-services', image: '/images/service-manicure.svg' });
  assert.equal(res.status, 200);
  assert.equal((await Service.findById(svc._id)).price, 400);
});

// ---------------- appointments + messages ----------------
async function makeAppointment() {
  return Appointment.create({
    reference: 'LN-ROLE0001', service: svc._id, serviceName: svc.name, serviceCategory: 'nail-services', servicePrice: 350, durationMinutes: 45,
    technicianId: 'ana', technicianName: 'Ana', date: futureDate(), startMinutes: 720, endMinutes: 780,
    customerName: 'Jane Customer', email: 'jane@example.com', phone: '0917 123 4567', emailVerified: true,
  });
}

t('business admin keeps managing appointments and messages', async () => {
  const appt = await makeAppointment();
  const msg = await ContactMessage.create({ name: 'Sam', email: 'sam@example.com', subject: 'Hello', message: 'A question about nails' });
  const list = await request(app).get('/api/admin/appointments').set(owner.auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.data[0].reference, 'LN-ROLE0001');
  const confirm = await request(app).patch(`/api/admin/appointments/${appt._id}/status`).set(owner.auth).send({ status: 'confirmed' });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.data.status, 'confirmed');
  assert.equal((await request(app).post(`/api/admin/appointments/${appt._id}/resend-email`).set(owner.auth)).status, 200);
  const msgs = await request(app).get('/api/admin/messages').set(owner.auth);
  assert.equal(msgs.body.data[0].subject, 'Hello');
  assert.equal((await request(app).patch(`/api/admin/messages/${msg._id}/read`).set(owner.auth)).body.data.read, true);
});

t('the developer account cannot see or change customer data', async () => {
  const appt = await makeAppointment();
  const msg = await ContactMessage.create({ name: 'Sam', email: 'sam@example.com', subject: 'Private', message: 'Customer message' });
  const attempts = [
    request(app).get('/api/admin/appointments').set(dev.auth),
    request(app).patch(`/api/admin/appointments/${appt._id}/status`).set(dev.auth).send({ status: 'cancelled' }),
    request(app).post(`/api/admin/appointments/${appt._id}/resend-email`).set(dev.auth),
    request(app).get('/api/admin/messages').set(dev.auth),
    request(app).patch(`/api/admin/messages/${msg._id}/read`).set(dev.auth),
  ];
  for (const res of await Promise.all(attempts)) {
    assert.equal(res.status, 403);
    assert.ok(!JSON.stringify(res.body).includes('jane@example.com') && !JSON.stringify(res.body).includes('Customer message'));
  }
  assert.equal((await Appointment.findById(appt._id)).status, 'pending', 'unchanged');
  assert.equal((await ContactMessage.findById(msg._id)).read, false, 'unchanged');
});

// ---------------- the database is the authority ----------------
t('changing a role in the database takes effect immediately, even for an already-issued token', async () => {
  await Admin.updateOne({ email: DEV.email }, { $set: { role: 'admin' } }); // demote the developer
  assert.equal((await request(app).delete(`/api/admin/services/${svc._id}`).set(dev.auth)).status, 403);
  assert.equal((await request(app).get('/api/admin/appointments').set(dev.auth)).status, 200);
  assert.equal((await Service.countDocuments({ _id: svc._id })), 1);
  await Admin.updateOne({ email: DEV.email }, { $set: { role: 'developer' } });
  assert.equal((await request(app).put(`/api/admin/services/${svc._id}`).set(dev.auth).send({ name: 'Classic Manicure', description: 'Back again', price: 350, durationMinutes: 45, category: 'nail-services' })).status, 200);
});

t('an account created before roles existed (no role field) works as business admin', async () => {
  await Admin.collection.insertOne({ email: 'legacy@luxenails.test', passwordHash: await bcrypt.hash('legacy-password-1', 10), tokenVersion: 0 });
  const legacy = await login({ email: 'legacy@luxenails.test', password: 'legacy-password-1' });
  assert.equal(legacy.body.role, 'admin');
  assert.equal((await request(app).get('/api/admin/services').set(legacy.auth)).status, 200);
  assert.equal((await request(app).get('/api/admin/appointments').set(legacy.auth)).status, 200);
  assert.equal((await request(app).delete(`/api/admin/services/${svc._id}`).set(legacy.auth)).status, 403);
});

t('an unknown role in the database cannot log in or use an old token', async () => {
  await Admin.collection.updateOne({ email: OWNER.email }, { $set: { role: 'superuser' } });
  const res = await request(app).post('/api/admin/login').send(OWNER);
  assert.equal(res.status, 401);
  assert.equal((await request(app).get('/api/admin/me').set(owner.auth)).status, 403);
});

t('logout and token revocation work for both roles', async () => {
  for (const who of [owner, dev]) {
    assert.equal((await request(app).post('/api/admin/logout').set(who.auth)).status, 200);
    assert.equal((await request(app).get('/api/admin/me').set(who.auth)).status, 401);
  }
});

// ---------------- provisioning ----------------
t('provisioning: the developer account is created with a hashed password and the developer role', async () => {
  const doc = await Admin.findOne({ email: DEV.email }).select('+passwordHash');
  assert.equal(doc.role, 'developer');
  assert.notEqual(doc.passwordHash, DEV.password);
  assert.ok(await bcrypt.compare(DEV.password, doc.passwordHash));
  assert.match(doc.passwordHash, /^\$2[aby]\$12\$/, 'bcrypt cost 12');
});

t('provisioning: re-running resets the password and signs out existing developer sessions', async () => {
  const result = await provisionDeveloper(DEV.email, 'another-long-passphrase-9');
  assert.equal(result.action, 'password-updated');
  assert.equal((await request(app).get('/api/admin/me').set(dev.auth)).status, 401, 'old session revoked');
  assert.equal((await request(app).post('/api/admin/login').send(DEV)).status, 401, 'old password no longer works');
  assert.equal((await request(app).post('/api/admin/login').send({ email: DEV.email, password: 'another-long-passphrase-9' })).status, 200);
  assert.equal(await Admin.countDocuments({ email: DEV.email }), 1);
});

t('provisioning refuses weak passwords, bad emails, and the business admin email', async () => {
  await assert.rejects(() => provisionDeveloper('new@dev.test', 'short'), /at least 12/);
  await assert.rejects(() => provisionDeveloper('not-an-email', 'a-long-developer-passphrase'), /valid email/);
  await assert.rejects(() => provisionDeveloper('newdev@dev.test', 'my-newdev-password-123'), /email name/);
  await assert.rejects(() => provisionDeveloper(OWNER.email, 'a-long-developer-passphrase'), /business admin/);
  assert.equal((await Admin.findOne({ email: OWNER.email })).role, 'admin', 'owner untouched');
  assert.equal(await Admin.countDocuments(), 2);
});

t('provisioning script: works non-interactively, never prints the password, and rejects a weak one', async () => {
  const run = (env) => spawnSync(process.execPath, ['src/utils/createDeveloper.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, MONGODB_URI: uri, ...env }, encoding: 'utf8' });
  const ok = run({ DEVELOPER_EMAIL: 'second.dev@maintainer.test', DEVELOPER_PASSWORD: 'second-dev-passphrase-77' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Developer account created/);
  assert.ok(!(ok.stdout + ok.stderr).includes('second-dev-passphrase-77'), 'password never printed');
  assert.equal((await Admin.findOne({ email: 'second.dev@maintainer.test' })).role, 'developer');
  const weak = run({ DEVELOPER_EMAIL: 'third@maintainer.test', DEVELOPER_PASSWORD: 'weak' });
  assert.equal(weak.status, 1);
  assert.match(weak.stderr, /at least 12/);
  assert.ok(!(weak.stdout + weak.stderr).includes('weak\n'));
  assert.equal(await Admin.countDocuments({ email: 'third@maintainer.test' }), 0);
});

t('seed script: the owner account stays "admin" and the seed can never overwrite the developer account', async () => {
  const seed = (email) => spawnSync(process.execPath, ['src/utils/seed.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, MONGODB_URI: uri, JWT_SECRET: 'k'.repeat(40), ADMIN_EMAIL: email, ADMIN_PASSWORD: 'seed-password-12345' }, encoding: 'utf8' });
  const clash = seed(DEV.email);
  assert.match(clash.stdout, /developer account/);
  const stillDev = await Admin.findOne({ email: DEV.email }).select('+passwordHash');
  assert.equal(stillDev.role, 'developer');
  assert.ok(await bcrypt.compare(DEV.password, stillDev.passwordHash), 'developer password not overwritten');
  const fresh = seed('fresh.owner@luxenails.test');
  assert.match(fresh.stdout, /Created admin/);
  assert.equal((await Admin.findOne({ email: 'fresh.owner@luxenails.test' })).role, 'admin');
});

test('teardown', { skip }, async () => { await fs.rm(UPLOAD_ROOT, { recursive: true, force: true }); await Service.deleteMany({}); await ContactMessage.deleteMany({}); await reset(); await disconnect(); await mongoose.disconnect().catch(() => {}); });
