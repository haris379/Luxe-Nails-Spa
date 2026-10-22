// Service image lifecycle against a real database: create, keep, replace, failure paths, delete.
// Run: MONGODB_TEST_URI=mongodb://127.0.0.1:27017/luxe-nails-test npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { skip, connect, disconnect, reset, app, Admin, Service, signToken } from './helpers/db.js';
import { SERVICE_DIR, UPLOAD_ROOT, removeImageIfUnused, saveServiceImage } from '../src/utils/uploads.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const base = { name: 'Gel Manicure', description: 'A lovely service', price: '450', durationMinutes: '60', category: 'nail-services' };

let auth;
const files = async () => (await fs.readdir(SERVICE_DIR).catch(() => [])).sort();
const exists = (url) => fs.access(path.join(SERVICE_DIR, url.split('/').pop())).then(() => true, () => false);

const t = (name, fn) => test(name, { skip }, async () => {
  await reset();
  await Service.deleteMany({});
  await fs.rm(SERVICE_DIR, { recursive: true, force: true });
  auth = { Authorization: `Bearer ${signToken(await Admin.create({ email: 'dev@example.com', passwordHash: 'x', role: 'developer' }))}` };
  await fn();
});

const send = (method, url, fields, file) => {
  let r = request(app)[method](url).set(auth);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  return file ? r.attach('imageFile', file.buf, { filename: file.name, contentType: file.type }) : r;
};
const create = (fields = base, file) => send('post', '/api/admin/services', fields, file);
const edit = (id, fields, file) => send('put', `/api/admin/services/${id}`, fields, file);
const png = { buf: PNG, name: 'photo.png', type: 'image/png' };
const webp = { buf: WEBP, name: 'new.webp', type: 'image/webp' };

test('setup', { skip }, async () => { await connect(); });

t('ADD: image uploaded, stored on the server, URL saved on the service, no filesystem path exposed', async () => {
  const res = await create(base, png);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const url = res.body.data.image;
  assert.match(url, /^\/uploads\/services\/[a-f0-9]{32}\.png$/);
  assert.ok(await exists(url));
  assert.ok(!JSON.stringify(res.body).includes(UPLOAD_ROOT), 'server path leaked');
  assert.equal((await Service.findById(res.body.data._id)).image, url);
  const pub = await request(app).get('/api/services');
  assert.equal(pub.body.data[0].image, url);
  const served = await request(app).get(url).buffer(true).parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
  assert.equal(served.status, 200);
  assert.ok(served.body.equals(PNG), 'served bytes match the upload');
});

t('ADD: stored type follows the real content, not the claimed name (a WebP named .png is saved as .webp)', async () => {
  const res = await create(base, { buf: WEBP, name: 'looks-like.png', type: 'image/png' });
  assert.equal(res.status, 201);
  assert.match(res.body.data.image, /\.webp$/);
});

t('ADD: without an image still works (multipart and JSON), and a manual path is kept as-is', async () => {
  const none = await create(base);
  assert.equal(none.status, 201);
  assert.equal(none.body.data.image, '');
  const manual = await create({ ...base, name: 'Manual Path', image: '/images/service-gel.svg' });
  assert.equal(manual.body.data.image, '/images/service-gel.svg');
  const json = await request(app).post('/api/admin/services').set(auth).send({ name: 'Json Service', description: 'Json body', price: 100, durationMinutes: 30, isStartingPrice: false, active: false, image: '/images/service-art.svg' });
  assert.equal(json.status, 201);
  assert.equal(json.body.data.active, false, 'JSON booleans still work');
  assert.equal(json.body.data.image, '/images/service-art.svg');
  assert.deepEqual(await files(), [], 'no files were created');
});

t('ADD: FormData booleans "true"/"false" are read correctly (not all treated as true)', async () => {
  const off = await create({ ...base, active: 'false', isStartingPrice: 'false' });
  assert.equal(off.body.data.active, false);
  assert.equal(off.body.data.isStartingPrice, false);
  const on = await create({ ...base, name: 'Another One', active: 'true', isStartingPrice: 'true' });
  assert.equal(on.body.data.active, true);
  assert.equal(on.body.data.isStartingPrice, true);
});

t('ADD: the database failing after the file was saved leaves no orphan file', async () => {
  const original = Service.create;
  Service.create = async () => { throw new Error('db down'); };
  try {
    const res = await create(base, png);
    assert.equal(res.status, 500);
  } finally { Service.create = original; }
  assert.deepEqual(await files(), []);
});

t('EDIT: with no new image the existing image is kept (field omitted, or sent back unchanged)', async () => {
  const created = (await create(base, png)).body.data;
  const omitted = await edit(created._id, { ...base, name: 'Renamed' });
  assert.equal(omitted.status, 200);
  assert.equal(omitted.body.data.image, created.image);
  const same = await edit(created._id, { ...base, name: 'Renamed Again', image: created.image });
  assert.equal(same.body.data.image, created.image);
  assert.ok(await exists(created.image), 'file still on disk');
  assert.equal((await files()).length, 1);
});

t('EDIT: a replacement image is saved, the service switches to it, and the old file is deleted afterwards', async () => {
  const created = (await create(base, png)).body.data;
  const res = await edit(created._id, base, webp);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.notEqual(res.body.data.image, created.image);
  assert.match(res.body.data.image, /\.webp$/);
  assert.ok(await exists(res.body.data.image));
  assert.equal(await exists(created.image), false, 'old image removed');
  assert.equal((await files()).length, 1);
});

t('EDIT: a failed update (invalid fields) keeps the old image and writes no new file', async () => {
  const created = (await create(base, png)).body.data;
  const bad = await edit(created._id, { ...base, price: 'abc' }, webp);
  assert.equal(bad.status, 400);
  assert.equal((await Service.findById(created._id)).image, created.image);
  assert.deepEqual(await files(), [created.image.split('/').pop()]);
});

t('EDIT: a database failure after saving the new file removes the new file and keeps the old one', async () => {
  const created = (await create(base, png)).body.data;
  const original = Service.findByIdAndUpdate;
  Service.findByIdAndUpdate = async () => { throw new Error('db down'); };
  try {
    const res = await edit(created._id, base, webp);
    assert.equal(res.status, 500);
  } finally { Service.findByIdAndUpdate = original; }
  assert.equal((await Service.findById(created._id)).image, created.image);
  assert.ok(await exists(created.image), 'old image untouched');
  assert.equal((await files()).length, 1, 'no orphaned new file');
});

t('EDIT: an unknown service id is a 404 and nothing is stored', async () => {
  const res = await edit('c'.repeat(24), base, png);
  assert.equal(res.status, 404);
  assert.deepEqual(await files(), []);
});

t('EDIT: an image shared with another service is not deleted until the last one stops using it', async () => {
  const first = (await create(base, png)).body.data;
  const second = (await create({ ...base, name: 'Shares Image', image: first.image })).body.data;
  assert.equal(second.image, first.image);
  await edit(first._id, base, webp);
  assert.ok(await exists(first.image), 'still used by the second service');
  await edit(second._id, { ...base, name: 'Shares Image' }, webp);
  assert.equal(await exists(first.image), false, 'now unused, so it is removed');
});

t('EDIT: replacing a manual path (frontend asset) never deletes anything', async () => {
  const created = (await create({ ...base, image: '/images/service-gel.svg' })).body.data;
  const res = await edit(created._id, { ...base, image: '/images/service-gel.svg' }, png);
  assert.equal(res.status, 200);
  assert.match(res.body.data.image, /^\/uploads\/services\//);
  assert.equal(await removeImageIfUnused('/images/service-gel.svg', created._id), false);
  assert.equal(await removeImageIfUnused('/uploads/services/../../package.json', created._id), false);
});

t('EDIT: clearing the image path removes an uploaded image; JSON edits still work', async () => {
  const created = (await create(base, png)).body.data;
  const cleared = await request(app).put(`/api/admin/services/${created._id}`).set(auth).send({ ...base, price: 450, durationMinutes: 60, image: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.image, '');
  assert.equal(await exists(created.image), false);
});

t('DELETE: removing a service removes its uploaded image unless another service uses it', async () => {
  const a = (await create(base, png)).body.data;
  const b = (await create({ ...base, name: 'Shares Image', image: a.image })).body.data;
  assert.equal((await request(app).delete(`/api/admin/services/${a._id}`).set(auth)).status, 200);
  assert.ok(await exists(a.image), 'kept for the other service');
  assert.equal((await request(app).delete(`/api/admin/services/${b._id}`).set(auth)).status, 200);
  assert.equal(await exists(a.image), false);
});

t('upload failures never leave temp or partial files', async () => {
  for (let i = 0; i < 3; i++) await create(base, { buf: Buffer.from('not an image at all, sorry'), name: 'x.png', type: 'image/png' });
  await create(base, { buf: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), name: 'big.png', type: 'image/png' });
  assert.deepEqual(await files(), []);
});

t('existing public Services behaviour is unchanged (active only, image field present)', async () => {
  await create({ ...base, name: 'Visible' }, png);
  await create({ ...base, name: 'Hidden', active: 'false' });
  const pub = await request(app).get('/api/services');
  assert.deepEqual(pub.body.data.map((s) => s.name), ['Visible']);
  const one = await request(app).get(`/api/services/${pub.body.data[0]._id}`);
  assert.equal(one.body.data.image, pub.body.data[0].image);
});

test('teardown', { skip }, async () => { await fs.rm(UPLOAD_ROOT, { recursive: true, force: true }); await reset(); await Service.deleteMany({}); await disconnect(); });
