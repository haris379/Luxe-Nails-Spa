// Email verification + booking workflow against a real database.
// Run: MONGODB_TEST_URI=mongodb://127.0.0.1:27017/luxe-nails-test npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  skip, connect, disconnect, reset, makeService, futureDate, tokenFor, codeFor, requestCode, verifyCode, bookingBody, book, mails, mode, logged,
  EmailVerification, OtpThrottle, Appointment, SlotLock, Admin, app, env, signToken, business,
} from './helpers/db.js';

const A = 'alice@example.com';
const B = 'bob@example.com';
let service;

test('setup', { skip }, async () => { await connect(); });

const t = (name, fn) => test(name, { skip }, async () => { await reset(); service = await makeService(); await fn(); });

// ---------------- OTP request ----------------
t('valid email: a code is emailed, response never contains it', async () => {
  const res = await requestCode(A);
  assert.equal(res.status, 202);
  const code = codeFor(A);
  assert.match(code, /^\d{6}$/);
  assert.ok(!JSON.stringify(res.body).includes(code), 'OTP leaked in API response');
  assert.equal(res.body.data.expiresInSeconds, 600);
  assert.equal(res.body.data.cooldownSeconds, 60);
  assert.ok(mails[0].html.includes(code) && mails[0].text.includes(code));
});

t('invalid email formats are rejected before anything is sent', async () => {
  for (const email of ['nope', 'a@b', '', '   ', 'x'.repeat(200) + '@example.com']) {
    const res = await requestCode(email);
    assert.equal(res.status, 400, email);
  }
  assert.equal(mails.length, 0);
});

t('the code is stored only as a hash, and is never logged', async () => {
  await requestCode(A);
  const code = codeFor(A);
  const rec = await EmailVerification.findOne({ email: A }).lean();
  assert.notEqual(rec.codeHash, code);
  assert.ok(!JSON.stringify(rec).includes(code), 'plaintext OTP stored');
  await verifyCode(A, '000000'); // generates error paths too
  assert.ok(!logged.some((l) => l.includes(code)), 'OTP appeared in logs');
});

t('codes are six digits, from a secure source', async () => {
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const email = `u${i}@example.com`;
    await requestCode(email);
    const c = codeFor(email);
    assert.match(c, /^\d{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size >= 11, `codes should vary, got ${seen.size} distinct of 12`);
});

t('addresses are normalized (case and spaces) so verification belongs to one exact address', async () => {
  const res = await requestCode('  Alice@Example.COM ');
  assert.equal(res.status, 202);
  assert.ok(codeFor(A), 'mail goes to the lowercase address');
});

// ---------------- cooldown / limits ----------------
t('resending within 60 seconds is blocked with a retry time', async () => {
  assert.equal((await requestCode(A)).status, 202);
  const again = await requestCode(A);
  assert.equal(again.status, 429);
  assert.equal(again.body.code, 'COOLDOWN');
  assert.ok(again.body.errors.retryAfterSeconds >= 1 && again.body.errors.retryAfterSeconds <= 60);
  assert.equal(mails.length, 1, 'no second email');
  assert.equal(await EmailVerification.countDocuments({ email: A }), 1);
});

t('the cooldown is per address: another address can still get a code', async () => {
  assert.equal((await requestCode(A)).status, 202);
  assert.equal((await requestCode(B)).status, 202);
});

t('after the cooldown passes a new code is sent, and the old one stops working', async () => {
  await requestCode(A);
  const first = codeFor(A);
  await OtpThrottle.updateOne({ email: A }, { $set: { nextAllowedAt: new Date(Date.now() - 1000) } });
  assert.equal((await requestCode(A)).status, 202);
  const second = codeFor(A);
  const old = await verifyCode(A, first);
  assert.equal(old.status, 400, 'the replaced code no longer works');
  assert.equal(await EmailVerification.countDocuments({ email: A, status: 'superseded' }), 1);
  assert.equal((await verifyCode(A, second)).status, 200);
});

t('at most 5 codes per address per hour', async () => {
  for (let i = 0; i < 5; i++) await EmailVerification.create({ email: A, codeHash: 'x', status: 'superseded', expiresAt: new Date() });
  const res = await requestCode(A);
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'TOO_MANY_REQUESTS');
  assert.equal(mails.length, 0);
});

// ---------------- OTP verify ----------------
t('correct code verifies and returns a booking authorization', async () => {
  await requestCode(A);
  const res = await verifyCode(A, codeFor(A));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.verified, true);
  assert.ok(res.body.data.verificationToken.length >= 40);
  const rec = await EmailVerification.findOne({ email: A }).lean();
  assert.equal(rec.status, 'verified');
  assert.notEqual(rec.tokenHash, res.body.data.verificationToken, 'token stored hashed');
});

t('wrong code: error with remaining attempts, nothing verified', async () => {
  await requestCode(A);
  const right = codeFor(A);
  const wrong = right === '123456' ? '654321' : '123456';
  const res = await verifyCode(A, wrong);
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_CODE');
  assert.equal(res.body.errors.attemptsRemaining, 4);
  assert.ok(!JSON.stringify(res.body).includes(right));
  assert.equal((await EmailVerification.findOne({ email: A })).status, 'pending');
});

t('malformed codes are rejected', async () => {
  await requestCode(A);
  for (const code of ['12345', '1234567', 'abcdef', '12 456', '']) assert.equal((await verifyCode(A, code)).status, 400, code);
});

t('expired code is rejected', async () => {
  await requestCode(A);
  const code = codeFor(A);
  await EmailVerification.updateOne({ email: A }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const res = await verifyCode(A, code);
  assert.equal(res.status, 410);
  assert.equal(res.body.code, 'CODE_EXPIRED');
});

t('a code cannot be reused after success', async () => {
  await requestCode(A);
  const code = codeFor(A);
  assert.equal((await verifyCode(A, code)).status, 200);
  const again = await verifyCode(A, code);
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'CODE_ALREADY_USED');
});

t('too many wrong attempts locks the code, even for the right code', async () => {
  await requestCode(A);
  const right = codeFor(A);
  const wrong = right === '111111' ? '222222' : '111111';
  for (let i = 4; i >= 1; i--) {
    const r = await verifyCode(A, wrong);
    assert.equal(r.status, 400);
    assert.equal(r.body.errors.attemptsRemaining, i);
  }
  const fifth = await verifyCode(A, wrong);
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.code, 'TOO_MANY_ATTEMPTS');
  const tooLate = await verifyCode(A, right);
  assert.equal(tooLate.status, 429);
  assert.equal((await EmailVerification.findOne({ email: A })).status, 'pending', 'never verified');
});

t('verifying an address that never asked for a code fails', async () => {
  const res = await verifyCode('stranger@example.com', '123456');
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'NO_CODE');
});

t('a code sent to one address cannot verify another address', async () => {
  await requestCode(A);
  const res = await verifyCode(B, codeFor(A));
  assert.notEqual(res.status, 200);
});

// ---------------- email service failures ----------------
t('email delivery failure: helpful error, nothing verifiable, cooldown released for retry', async () => {
  mode.failIf = () => true;
  const res = await requestCode(A);
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'EMAIL_SEND_FAILED');
  assert.equal(await EmailVerification.countDocuments({ email: A }), 0);
  mode.failIf = null;
  assert.equal((await requestCode(A)).status, 202, 'can retry immediately once mail works');
});

t('email not configured: verification (and therefore booking) is reported unavailable', async () => {
  const saved = env.smtp.host;
  env.smtp.host = '';
  const res = await requestCode(A);
  env.smtp.host = saved;
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'EMAIL_NOT_CONFIGURED');
});

// ---------------- booking requires verification ----------------
t('booking without any verification is rejected, and nothing is saved', async () => {
  const res = await book(bookingBody(service));
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(await Appointment.countDocuments(), 0);
  assert.equal(await SlotLock.countDocuments(), 0);
});

t('a client-supplied "emailVerified" flag or fake token grants nothing', async () => {
  for (const extra of [{ emailVerified: true }, { verified: true, verificationToken: 'x'.repeat(43) }, { verificationToken: '' }, { verificationToken: 12345 }, { verificationToken: { $ne: null } }]) {
    const res = await book(bookingBody(service, extra));
    assert.equal(res.status, 403, JSON.stringify(extra));
  }
  assert.equal(await Appointment.countDocuments(), 0);
});

t('a code that was requested but not entered does not authorize a booking', async () => {
  await requestCode(A);
  const res = await book(bookingBody(service, { email: A, verificationToken: codeFor(A) }));
  assert.equal(res.status, 403);
});

t('a verification for one email cannot be used for a different email', async () => {
  const token = await tokenFor(A);
  const res = await book(bookingBody(service, { email: B, verificationToken: token }));
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(await Appointment.countDocuments(), 0);
});

t('changing the email after verifying requires verifying the new address', async () => {
  const token = await tokenFor(A);
  assert.equal((await book(bookingBody(service, { email: B, verificationToken: token }))).status, 403);
  const tokenB = await tokenFor(B);
  assert.equal((await book(bookingBody(service, { email: B, verificationToken: tokenB }))).status, 201);
});

t('email matching ignores case and spaces but is otherwise exact', async () => {
  const token = await tokenFor(A);
  const res = await book(bookingBody(service, { email: '  ALICE@example.com ', verificationToken: token }));
  assert.equal(res.status, 201);
  assert.equal((await Appointment.findOne({})).email, A);
});

t('an expired authorization is rejected', async () => {
  const token = await tokenFor(A);
  await EmailVerification.updateOne({ email: A }, { $set: { authExpiresAt: new Date(Date.now() - 1000) } });
  const res = await book(bookingBody(service, { email: A, verificationToken: token }));
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'VERIFICATION_EXPIRED');
});

t('a revoked authorization is rejected', async () => {
  const token = await tokenFor(A);
  await EmailVerification.updateOne({ email: A }, { $set: { status: 'revoked' } });
  assert.equal((await book(bookingBody(service, { email: A, verificationToken: token }))).status, 403);
});

t('other invalid fields are still rejected (400) even with a valid verification', async () => {
  const token = await tokenFor(A);
  const bad = { email: A, verificationToken: token };
  assert.equal((await book(bookingBody(service, { ...bad, phone: 'abc' }))).status, 400);
  assert.equal((await book(bookingBody(service, { ...bad, date: '2020-01-01' }))).status, 400);
  assert.equal((await book(bookingBody(service, { ...bad, customerName: '' }))).status, 400);
  assert.equal(await Appointment.countDocuments(), 0);
  // ...and the verification is still usable afterwards
  assert.equal((await book(bookingBody(service, bad))).status, 201);
});

// ---------------- successful booking + emails ----------------
t('verified booking: saved as pending, marked verified, email sent only AFTER it is saved', async () => {
  const token = await tokenFor(A);
  let savedAtSendTime = null;
  mode.onSend = async (m) => { if (!/verification code/i.test(m.subject)) savedAtSendTime = await Appointment.countDocuments({ email: A }); };
  const res = await book(bookingBody(service, { email: A, verificationToken: token }));
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'pending');
  assert.equal(res.body.data.emailVerified, true);
  assert.equal(res.body.data.emailStatus, 'sent');
  assert.match(res.body.data.reference, /^LN-[0-9A-F]{8}$/);
  assert.equal(savedAtSendTime, 1, 'booking email was sent before the booking existed');

  const appt = await Appointment.findOne({ email: A }).lean();
  assert.equal(appt.emailVerified, true);
  assert.ok(appt.emailVerifiedAt);
  assert.equal(appt.bookingEmail.status, 'sent');
  assert.equal((await EmailVerification.findOne({ email: A })).status, 'consumed');

  const mail = mails.filter((m) => !/verification code/i.test(m.subject)).at(-1);
  assert.equal(mail.to, A);
  for (const needle of [res.body.data.reference, 'Test Manicure', 'Jane Doe', business.timezone, '350', 'pending', business.contact.phone]) {
    assert.ok(mail.text.includes(needle) || mail.text.toLowerCase().includes(needle.toLowerCase()), `text missing ${needle}`);
  }
  assert.ok(mail.html.includes('<table') && mail.html.includes('viewport'), 'responsive HTML template');
});

t('no booking email is sent when the booking fails', async () => {
  const token = await tokenFor(A);
  mails.length = 0;
  await book(bookingBody(service, { email: A, verificationToken: token, phone: 'abc' }));
  assert.equal(mails.length, 0);
});

// ---------------- one verification = one booking ----------------
t('one authorization cannot create a second booking', async () => {
  const token = await tokenFor(A);
  assert.equal((await book(bookingBody(service, { email: A, verificationToken: token, time: '12:00' }))).status, 201);
  const second = await book(bookingBody(service, { email: A, verificationToken: token, time: '15:00' }));
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'VERIFICATION_ALREADY_USED');
  assert.equal(await Appointment.countDocuments(), 1);
});

t('retrying the same request (network retry) returns the same booking, no duplicate, no second email', async () => {
  const token = await tokenFor(A);
  const body = bookingBody(service, { email: A, verificationToken: token });
  const first = await book(body);
  const mailsAfterFirst = mails.length;
  const retry = await book(body);
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.replayed, true);
  assert.equal(retry.body.data.reference, first.body.data.reference);
  assert.equal(await Appointment.countDocuments(), 1);
  assert.equal(mails.length, mailsAfterFirst);
});

t('parallel identical submissions (double click) create exactly one booking and no orphan locks', async () => {
  const token = await tokenFor(A);
  const body = bookingBody(service, { email: A, verificationToken: token });
  const results = await Promise.all(Array.from({ length: 6 }, () => book(body)));
  const codes = results.map((r) => r.status).join(',');
  assert.ok(results.every((r) => [200, 201, 409].includes(r.status)), `no server errors, got ${codes}`);
  assert.equal(results.filter((r) => r.status === 201).length, 1, `exactly one creator, got ${codes}`);
  const refs = new Set(results.filter((r) => r.status !== 409).map((r) => r.body.data.reference));
  assert.equal(refs.size, 1, 'every successful response describes the same booking');
  assert.equal(await Appointment.countDocuments(), 1);
  assert.equal(await SlotLock.countDocuments(), 2, 'a 60-minute service holds exactly 2 slots');
});

t('one authorization used for several different bookings in parallel: only one succeeds', async () => {
  const token = await tokenFor(A);
  const times = ['12:00', '14:00', '16:00', '13:00'];
  const results = await Promise.all(times.map((time) => book(bookingBody(service, { email: A, verificationToken: token, time }))));
  assert.equal(results.filter((r) => r.status === 201).length, 1, results.map((r) => r.status).join(','));
  assert.equal(await Appointment.countDocuments(), 1);
});

// ---------------- slot races ----------------
t('two customers racing for the same technician and slot: one wins, the other gets 409 and can pick another time', async () => {
  const [ta, tb] = [await tokenFor(A), await tokenFor(B)];
  const tech = business.technicians[0].id;
  const [ra, rb] = await Promise.all([
    book(bookingBody(service, { email: A, verificationToken: ta, technicianId: tech })),
    book(bookingBody(service, { email: B, verificationToken: tb, technicianId: tech })),
  ]);
  assert.deepEqual([ra.status, rb.status].sort(), [201, 409]);
  assert.equal(await Appointment.countDocuments(), 1);
  const loser = ra.status === 409 ? { email: A, token: ta } : { email: B, token: tb };
  assert.equal((await book(bookingBody(service, { email: loser.email, verificationToken: loser.token, time: '15:00', technicianId: tech }))).status, 201, 'verification survives a slot conflict');
});

t('many customers, same slot, "no preference": exactly one booking per technician', async () => {
  const people = Array.from({ length: business.technicians.length + 2 }, (_, i) => `p${i}@example.com`);
  const tokens = [];
  for (const e of people) tokens.push(await tokenFor(e));
  const results = await Promise.all(people.map((email, i) => book(bookingBody(service, { email, verificationToken: tokens[i] }))));
  assert.equal(results.filter((r) => r.status === 201).length, business.technicians.length);
  assert.equal(results.filter((r) => r.status === 409).length, 2);
  assert.equal(await Appointment.countDocuments(), business.technicians.length);
});

// ---------------- booking email failures ----------------
t('booking email failure: booking is saved once, failure recorded, retry does not duplicate it', async () => {
  const token = await tokenFor(A);
  mode.failIf = (m) => !/verification code/i.test(m.subject);
  const body = bookingBody(service, { email: A, verificationToken: token });
  const res = await book(body);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.emailStatus, 'failed');
  const appt = await Appointment.findOne({ email: A }).lean();
  assert.equal(appt.bookingEmail.status, 'failed');
  assert.equal(appt.bookingEmail.attempts, 1);
  assert.equal(appt.bookingEmail.lastError, 'ECONNECTION');
  assert.ok(!JSON.stringify(appt.bookingEmail).includes('simulated'), 'no message text stored');
  const retry = await book(body);
  assert.equal(retry.status, 200);
  assert.equal(await Appointment.countDocuments(), 1);
});

// ---------------- admin integration ----------------
async function adminToken() {
  const admin = await Admin.create({ email: 'admin@example.com', passwordHash: 'x' });
  return `Bearer ${signToken(admin)}`;
}

t('admin sees verification and email status; confirming sends the confirmed email', async () => {
  const token = await tokenFor(A);
  const created = await book(bookingBody(service, { email: A, verificationToken: token }));
  const auth = await adminToken();
  const list = await request(app).get('/api/admin/appointments').set('Authorization', auth);
  assert.equal(list.body.data[0].emailVerified, true);
  assert.equal(list.body.data[0].bookingEmail.status, 'sent');
  assert.equal(list.body.data[0].status, 'pending');

  const id = list.body.data[0]._id;
  mails.length = 0;
  const confirm = await request(app).patch(`/api/admin/appointments/${id}/status`).set('Authorization', auth).send({ status: 'confirmed' });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.data.status, 'confirmed');
  assert.equal(confirm.body.data.confirmedEmail.status, 'sent');
  assert.match(mails[0].subject, /is confirmed/i);
  assert.equal(mails[0].to, A);
  assert.ok(mails[0].text.includes(created.body.data.reference));
});

t('admin cannot confirm a booking whose email was never verified (pre-verification bookings)', async () => {
  const legacy = await Appointment.create({
    reference: 'LN-LEGACY01', service: service._id, serviceName: 'Old', servicePrice: 1, durationMinutes: 60, technicianId: 'ana', technicianName: 'Ana',
    date: futureDate(), startMinutes: 720, endMinutes: 780, customerName: 'Old Customer', email: 'old@example.com', phone: '0917 111 2222',
  });
  const auth = await adminToken();
  const res = await request(app).patch(`/api/admin/appointments/${legacy._id}/status`).set('Authorization', auth).send({ status: 'confirmed' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal((await Appointment.findById(legacy._id)).status, 'pending');
  const resend = await request(app).post(`/api/admin/appointments/${legacy._id}/resend-email`).set('Authorization', auth);
  assert.equal(resend.status, 409, 'no mail to an unverified address');
  // the admin can still cancel it
  assert.equal((await request(app).patch(`/api/admin/appointments/${legacy._id}/status`).set('Authorization', auth).send({ status: 'cancelled' })).status, 200);
});

t('failed notification can be retried safely by the admin', async () => {
  const token = await tokenFor(A);
  mode.failIf = (m) => !/verification code/i.test(m.subject);
  await book(bookingBody(service, { email: A, verificationToken: token }));
  const appt = await Appointment.findOne({ email: A });
  const auth = await adminToken();
  const stillBroken = await request(app).post(`/api/admin/appointments/${appt._id}/resend-email`).set('Authorization', auth);
  assert.equal(stillBroken.body.data.bookingEmail.status, 'failed');
  assert.equal(stillBroken.body.data.bookingEmail.attempts, 2);
  mode.failIf = null;
  const ok = await request(app).post(`/api/admin/appointments/${appt._id}/resend-email`).set('Authorization', auth);
  assert.equal(ok.body.data.bookingEmail.status, 'sent');
  assert.equal(await Appointment.countDocuments(), 1);
  const noAuth = await request(app).post(`/api/admin/appointments/${appt._id}/resend-email`);
  assert.equal(noAuth.status, 401);
});

t('a failed "confirmed" email does not undo the confirmation', async () => {
  const token = await tokenFor(A);
  await book(bookingBody(service, { email: A, verificationToken: token }));
  const appt = await Appointment.findOne({ email: A });
  mode.failIf = () => true;
  const res = await request(app).patch(`/api/admin/appointments/${appt._id}/status`).set('Authorization', await adminToken()).send({ status: 'confirmed' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'confirmed');
  assert.equal(res.body.data.confirmedEmail.status, 'failed');
});

t('existing behaviour: cancelling frees the slot for the next customer', async () => {
  const tech = business.technicians[0].id;
  const first = await book(bookingBody(service, { email: A, verificationToken: await tokenFor(A), technicianId: tech }));
  assert.equal(first.status, 201);
  assert.equal((await book(bookingBody(service, { email: B, verificationToken: await tokenFor(B), technicianId: tech }))).status, 409);
  const appt = await Appointment.findOne({ email: A });
  await request(app).patch(`/api/admin/appointments/${appt._id}/status`).set('Authorization', await adminToken()).send({ status: 'cancelled' });
  assert.equal((await book(bookingBody(service, { email: B, verificationToken: await tokenFor(B), technicianId: tech }))).status, 201);
});

// ---------------- existing booking behaviour, now through verification ----------------
t('spa service uses its own duration and category; overlapping times are blocked', async () => {
  const spa = await makeService({ name: 'Hot Stone Massage', category: 'massage', durationMinutes: 90, price: 900 });
  const tech = business.technicians[1].id;
  const res = await book(bookingBody(spa, { email: A, verificationToken: await tokenFor(A), time: '12:00', technicianId: tech }));
  assert.equal(res.status, 201);
  assert.equal(res.body.data.serviceCategory, 'massage');
  assert.equal(res.body.data.servicePrice, 900);
  const saved = await Appointment.findOne({ email: A });
  assert.equal(saved.endMinutes - saved.startMinutes, 90);
  assert.equal(await SlotLock.countDocuments(), 3);
  const overlap = await book(bookingBody(spa, { email: B, verificationToken: await tokenFor(B), time: '13:00', technicianId: tech }));
  assert.equal(overlap.status, 409);
  const after = await book(bookingBody(spa, { email: B, verificationToken: await tokenFor(B), time: '13:30', technicianId: tech }));
  assert.equal(after.status, 201);
});

t('price and duration come from the server, not the request', async () => {
  const res = await book(bookingBody(service, { email: A, verificationToken: await tokenFor(A), servicePrice: 1, durationMinutes: 15, price: 0 }));
  assert.equal(res.status, 201);
  const saved = await Appointment.findOne({ email: A });
  assert.equal(saved.servicePrice, 350);
  assert.equal(saved.durationMinutes, 60);
});

t('past dates and unknown or inactive services are rejected even when verified', async () => {
  const token = await tokenFor(A);
  assert.equal((await book(bookingBody(service, { email: A, verificationToken: token, date: '2020-01-01' }))).status, 400);
  await service.updateOne({ active: false });
  assert.equal((await book(bookingBody(service, { email: A, verificationToken: token }))).status, 404);
  assert.equal(await Appointment.countDocuments(), 0);
});

t('availability reflects bookings made through the verified flow', async () => {
  const tech = business.technicians[0].id;
  const date = bookingBody(service).date;
  await book(bookingBody(service, { email: A, verificationToken: await tokenFor(A), technicianId: tech }));
  const url = `/api/appointments/availability?serviceId=${service._id}&date=${date}`;
  const one = await request(app).get(`${url}&technicianId=${tech}`);
  assert.equal(one.body.data.slots.find((x) => x.time === '12:00').available, false);
  const any = await request(app).get(url);
  assert.equal(any.body.data.slots.find((x) => x.time === '12:00').available, true, 'other technicians are still free');
});

test('teardown', { skip }, async () => { await reset(); await disconnect(); });
