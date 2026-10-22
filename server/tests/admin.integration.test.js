// Real login / logout against a real database (bcrypt hash, DB-verified sessions, token revocation).
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { skip, connect, disconnect, reset, app, Admin } from './helpers/db.js';

test('admin login, verified session, logout revokes the token', { skip }, async () => {
  await connect();
  await reset();
  await Admin.create({ email: 'owner@example.com', passwordHash: await bcrypt.hash('a-strong-passphrase', 10) });

  const bad = await request(app).post('/api/admin/login').send({ email: 'owner@example.com', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const unknown = await request(app).post('/api/admin/login').send({ email: 'nobody@example.com', password: 'a-strong-passphrase' });
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.message, unknown.body.message, 'same message: no account enumeration');

  const ok = await request(app).post('/api/admin/login').send({ email: 'OWNER@example.com', password: 'a-strong-passphrase' });
  assert.equal(ok.status, 200);
  const auth = { Authorization: `Bearer ${ok.body.data.token}` };
  assert.equal((await request(app).get('/api/admin/me').set(auth)).body.data.role, 'admin');
  assert.equal((await request(app).get('/api/admin/appointments').set(auth)).status, 200);

  assert.equal((await request(app).post('/api/admin/logout').set(auth)).status, 200);
  assert.equal((await request(app).get('/api/admin/me').set(auth)).status, 401);
  assert.equal((await request(app).get('/api/admin/appointments').set(auth)).status, 401);

  const again = await request(app).post('/api/admin/login').send({ email: 'owner@example.com', password: 'a-strong-passphrase' });
  assert.equal(again.status, 200, 'a fresh login after logout works');
  assert.equal((await request(app).get('/api/admin/me').set({ Authorization: `Bearer ${again.body.data.token}` })).status, 200);

  await Admin.deleteMany({});
  assert.equal((await request(app).get('/api/admin/me').set({ Authorization: `Bearer ${again.body.data.token}` })).status, 401, 'deleted admin loses access');
  await reset();
  await disconnect();
});
