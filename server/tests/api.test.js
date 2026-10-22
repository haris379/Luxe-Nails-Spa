// API tests that do not need a database: validation, auth guards, routing.
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'x'.repeat(40);
const { createApp } = await import('../src/createApp.js');
const { adminStore } = await import('../src/middleware/auth.js');
const ADMIN_ID = 'a'.repeat(24);
// Stand-in for the database lookup so these tests run without MongoDB.
const DEV_ID = 'd'.repeat(24);
adminStore.findById = async (id) => (id === ADMIN_ID ? { _id: ADMIN_ID, email: 'a@b.c', role: 'admin', tokenVersion: 0 } : id === DEV_ID ? { _id: DEV_ID, email: 'dev@b.c', role: 'developer', tokenVersion: 0 } : null);
const app = createApp();

test('GET /api/health', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /api/business returns hours and technicians', async () => {
  const res = await request(app).get('/api/business');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.technicians.length > 0);
});

test('unknown route returns JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('booking rejects an empty body with field errors (no DB needed)', async () => {
  const res = await request(app).post('/api/appointments').send({});
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.customerName);
  assert.ok(res.body.errors.serviceId);
});

test('booking rejects bad email and phone', async () => {
  const res = await request(app).post('/api/appointments').send({
    serviceId: 'a'.repeat(24), date: '2026-12-01', time: '10:00', customerName: 'Jane', email: 'nope', phone: 'abc',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.email);
  assert.ok(res.body.errors.phone);
});

test('booking rejects impossible dates', async () => {
  const res = await request(app).post('/api/appointments').send({
    serviceId: 'a'.repeat(24), date: '2026-02-31', time: '10:00', customerName: 'Jane', email: 'j@x.com', phone: '0917 123 4567',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.date);
});

test('contact form validates input', async () => {
  const res = await request(app).post('/api/contact').send({ name: 'A', email: 'bad', subject: '', message: 'short' });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.email);
  assert.ok(res.body.errors.message);
});

test('availability requires valid query params', async () => {
  const res = await request(app).get('/api/appointments/availability?serviceId=bad&date=2026-10-10');
  assert.equal(res.status, 400);
});

test('admin routes reject missing token', async () => {
  for (const [method, path] of [
    ['get', '/api/admin/appointments'], ['get', '/api/admin/services'], ['get', '/api/admin/messages'],
    ['post', '/api/admin/services'], ['patch', `/api/admin/appointments/${'a'.repeat(24)}/status`],
  ]) {
    const res = await request(app)[method](path);
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('admin routes reject forged tokens', async () => {
  const forged = jwt.sign({ sub: ADMIN_ID, role: 'admin' }, 'wrong-secret-wrong-secret-wrong-secret');
  const res = await request(app).get('/api/admin/appointments').set('Authorization', `Bearer ${forged}`);
  assert.equal(res.status, 401);
});

test('valid token without admin role is forbidden', async () => {
  const token = jwt.sign({ sub: ADMIN_ID, role: 'user' }, process.env.JWT_SECRET);
  const res = await request(app).get('/api/admin/appointments').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('valid admin token passes auth and reaches validation', async () => {
  const token = jwt.sign({ sub: ADMIN_ID, role: 'admin', email: 'a@b.c' }, process.env.JWT_SECRET);
  const res = await request(app).get('/api/admin/appointments?status=bogus').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 400);
  const me = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 200);
});

test('malformed JSON returns 400', async () => {
  const res = await request(app).post('/api/contact').set('Content-Type', 'application/json').send('{bad');
  assert.equal(res.status, 400);
});

test('admin appointment filter validates category', async () => {
  const token = jwt.sign({ sub: ADMIN_ID, role: 'admin', email: 'a@b.c' }, process.env.JWT_SECRET);
  const res = await request(app).get('/api/admin/appointments?category=bogus').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 400);
});

test('public service list rejects an unknown category', async () => {
  const res = await request(app).get('/api/services?category=bogus');
  assert.equal(res.status, 400);
});

test('business endpoint exposes the service categories', async () => {
  const res = await request(app).get('/api/business');
  assert.ok(res.body.data.categories.some((c) => c.id === 'massage'));
  assert.ok(res.body.data.categories.some((c) => c.id === 'nail-services'));
});

test('a developer cannot create a service with an invalid category', async () => {
  const token = jwt.sign({ sub: DEV_ID, role: 'developer', email: 'dev@b.c' }, process.env.JWT_SECRET);
  const res = await request(app).post('/api/admin/services').set('Authorization', `Bearer ${token}`)
    .send({ name: 'X Service', description: 'desc here', price: 100, durationMinutes: 30, category: 'hairdo' });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.category);
});
