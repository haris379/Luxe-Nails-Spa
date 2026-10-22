// Image upload: validation, authorization and safety checks that need no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'x'.repeat(40);
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `luxe-upload-unit-${process.pid}`);
const { createApp } = await import('../src/createApp.js');
const { adminStore } = await import('../src/middleware/auth.js');
const up = await import('../src/utils/uploads.js');
const app = createApp();

const ADMIN_ID = 'a'.repeat(24);
adminStore.findById = async (id) => (id === ADMIN_ID ? { _id: ADMIN_ID, email: 'dev@b.c', role: 'developer', tokenVersion: 0 } : null);
const adminAuth = { Authorization: `Bearer ${jwt.sign({ sub: ADMIN_ID, role: 'developer', email: 'dev@b.c', tv: 0 }, process.env.JWT_SECRET)}` };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
const fields = { name: 'Test Service', description: 'A test service', price: '100', durationMinutes: '60', category: 'nail-services' };

const post = (file, extra = {}, auth = adminAuth) => {
  let r = request(app).post('/api/admin/services').set(auth);
  for (const [k, v] of Object.entries({ ...fields, ...extra })) r = r.field(k, v);
  return file ? r.attach(file.field || 'imageFile', file.buf, { filename: file.name, contentType: file.type }) : r;
};
const filesOnDisk = async () => fs.readdir(up.SERVICE_DIR).catch(() => []);

test.after(async () => { await fs.rm(up.UPLOAD_ROOT, { recursive: true, force: true }); });

// ---------- content sniffing ----------
test('detectImageType identifies JPG, PNG and WebP by content', () => {
  assert.equal(up.detectImageType(PNG).ext, 'png');
  assert.equal(up.detectImageType(JPG).ext, 'jpg');
  assert.equal(up.detectImageType(WEBP).ext, 'webp');
});

test('detectImageType rejects GIF, SVG, scripts, executables, empty and tiny buffers', () => {
  for (const bad of [GIF, SVG, Buffer.from('MZ\x90\x00' + 'x'.repeat(40)), Buffer.from('<?php echo 1; ?>' + ' '.repeat(20)), Buffer.alloc(0), Buffer.from('abc'), null, 'text']) {
    assert.equal(up.detectImageType(bad), null);
  }
  const fakePng = Buffer.concat([Buffer.from('not really a png, just text'), PNG]);
  assert.equal(up.detectImageType(fakePng), null, 'signature must be at the start');
});

test('saveServiceImage stores under a random generated name with the detected extension', async () => {
  const a = await up.saveServiceImage(PNG);
  const b = await up.saveServiceImage(PNG);
  assert.notEqual(a, b);
  assert.match(a, /^\/uploads\/services\/[a-f0-9]{32}\.png$/);
  assert.ok((await filesOnDisk()).includes(a.split('/').pop()));
  await assert.rejects(() => up.saveServiceImage(SVG), (e) => e.status === 400 && e.code === 'INVALID_IMAGE');
});

// ---------- path safety ----------
test('only generated upload URLs are recognised (no traversal, no other folders, no other names)', () => {
  const good = `/uploads/services/${'a'.repeat(32)}.webp`;
  assert.equal(up.uploadedNameFromUrl(good), `${'a'.repeat(32)}.webp`);
  for (const bad of [
    '/uploads/services/../../.env', '/uploads/services/..%2f..%2f.env', `/uploads/services/${'a'.repeat(32)}.svg`, `/uploads/services/${'A'.repeat(32)}.png`,
    '/uploads/services/photo.png', '/uploads/other/' + 'a'.repeat(32) + '.png', `/uploads/services/sub/${'a'.repeat(32)}.png`, '/images/service-gel.svg',
    'https://evil.example/uploads/services/' + 'a'.repeat(32) + '.png', '', null, undefined, 42,
  ]) {
    assert.equal(up.uploadedNameFromUrl(bad), null, String(bad));
  }
});

test('removeUploadedFile never deletes anything outside the services folder', async () => {
  await up.ensureUploadDirs();
  const outside = path.join(up.UPLOAD_ROOT, 'precious.txt');
  await fs.writeFile(outside, 'keep me');
  for (const attempt of ['/uploads/services/../precious.txt', '/uploads/services/..%2fprecious.txt', outside, '../precious.txt']) {
    assert.equal(await up.removeUploadedFile(attempt), false);
  }
  assert.equal(await fs.readFile(outside, 'utf8'), 'keep me');
  const own = await up.saveServiceImage(PNG);
  assert.equal(await up.removeUploadedFile(own), true);
  assert.equal(await up.removeUploadedFile(own), false, 'already gone: no error');
});

// ---------- access control ----------
test('uploading without admin login is rejected and nothing is written', async () => {
  const before = (await filesOnDisk()).length;
  const res = await post({ buf: PNG, name: 'a.png', type: 'image/png' }, {}, {});
  assert.equal(res.status, 401);
  assert.equal((await filesOnDisk()).length, before);
});

test('a non-admin token cannot upload', async () => {
  const token = jwt.sign({ sub: ADMIN_ID, role: 'customer', tv: 0 }, process.env.JWT_SECRET);
  const res = await post({ buf: PNG, name: 'a.png', type: 'image/png' }, {}, { Authorization: `Bearer ${token}` });
  assert.equal(res.status, 403);
});

test('editing a service with an upload also requires admin', async () => {
  const res = await request(app).put(`/api/admin/services/${'b'.repeat(24)}`).field('name', 'x').attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(res.status, 401);
});

// ---------- file validation ----------
test('files that are not images are rejected even when named .png with an image MIME type', async () => {
  const before = (await filesOnDisk()).length;
  for (const buf of [SVG, Buffer.from('just some text pretending to be a picture'), GIF, Buffer.from('<?php system($_GET["c"]); ?>' + ' '.repeat(40))]) {
    const res = await post({ buf, name: 'photo.png', type: 'image/png' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_IMAGE');
    assert.ok(res.body.errors.imageFile);
  }
  assert.equal((await filesOnDisk()).length, before, 'no files left behind');
});

test('disallowed MIME types and extensions are rejected', async () => {
  for (const [name, type, buf] of [['a.gif', 'image/gif', GIF], ['a.svg', 'image/svg+xml', SVG], ['a.exe', 'application/octet-stream', PNG], ['a.png', 'text/html', PNG], ['a.html', 'image/png', PNG], ['noext', 'image/png', PNG]]) {
    const res = await post({ buf, name, type });
    assert.equal(res.status, 400, `${name} ${type}`);
    assert.equal(res.body.code, 'INVALID_IMAGE_TYPE');
  }
});

test('a client-supplied filename never controls the stored name or location', async () => {
  const before = await filesOnDisk();
  const res = await post({ buf: PNG, name: '../../../evil.png', type: 'image/png' }, { price: 'abc' }); // price invalid -> stops before saving
  assert.equal(res.status, 400);
  assert.deepEqual(await filesOnDisk(), before);
});

test('files over 5 MB are rejected with 413 and a clear message', async () => {
  const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  const res = await post({ buf: big, name: 'big.png', type: 'image/png' });
  assert.equal(res.status, 413);
  assert.equal(res.body.code, 'IMAGE_TOO_LARGE');
  assert.match(res.body.message, /5 MB/);
});

test('only one file, only in the "imageFile" field', async () => {
  const wrongField = await post({ buf: PNG, name: 'a.png', type: 'image/png', field: 'photo' });
  assert.equal(wrongField.status, 400);
  let r = request(app).post('/api/admin/services').set(adminAuth);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  const two = await r.attach('imageFile', PNG, { filename: 'a.png', contentType: 'image/png' }).attach('imageFile', PNG, { filename: 'b.png', contentType: 'image/png' });
  assert.equal(two.status, 400);
});

test('invalid form fields are rejected BEFORE any file is written', async () => {
  const before = (await filesOnDisk()).length;
  const res = await post({ buf: PNG, name: 'a.png', type: 'image/png' }, { name: '', price: '-5', category: 'hairdo' });
  assert.equal(res.status, 400);
  assert.equal((await filesOnDisk()).length, before);
});

// ---------- serving ----------
test('uploaded files are served with safe headers, and traversal/listing attempts fail', async () => {
  const url = await up.saveServiceImage(PNG);
  const ok = await request(app).get(url);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'image/png');
  assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  assert.equal(ok.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.match(ok.headers['cache-control'], /immutable/);
  for (const bad of ['/uploads/services/', '/uploads/', '/uploads/services/..%2f..%2fprecious.txt', '/uploads/services/%2e%2e/precious.txt', '/uploads/../.env']) {
    const res = await request(app).get(bad);
    assert.notEqual(res.status, 200, bad);
    assert.ok(!String(res.text).includes('keep me'));
  }
});

test('non-admin API responses still carry the helmet security headers', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});
