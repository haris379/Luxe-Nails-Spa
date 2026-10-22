// Shared setup for database-backed tests. Requires MONGODB_TEST_URI (any real MongoDB or compatible server).
process.env.JWT_SECRET ||= 'x'.repeat(40);
process.env.SMTP_HOST = 'smtp.test.invalid'; // makes email "configured"; nothing is ever sent
process.env.MAIL_FROM = 'Luxe Nails <no-reply@test.invalid>';
process.env.UPLOAD_DIR ||= `${(await import('node:os')).tmpdir()}/luxe-uploads-test-${process.pid}`;
process.env.DISABLE_RATE_LIMIT = 'true'; // per-IP limiter off; per-address rules are still tested

import mongoose from 'mongoose';
import request from 'supertest';

export const uri = process.env.MONGODB_TEST_URI;
export const skip = !uri && 'MONGODB_TEST_URI not set';

const { createApp } = await import('../../src/createApp.js');
const { mailTransport } = await import('../../src/utils/mailer.js');
const models = {
  Appointment: (await import('../../src/models/Appointment.js')).Appointment,
  SlotLock: (await import('../../src/models/SlotLock.js')).SlotLock,
  Service: (await import('../../src/models/Service.js')).Service,
  EmailVerification: (await import('../../src/models/EmailVerification.js')).EmailVerification,
  OtpThrottle: (await import('../../src/models/OtpThrottle.js')).OtpThrottle,
  Admin: (await import('../../src/models/Admin.js')).Admin,
};
export const { Appointment, SlotLock, Service, EmailVerification, OtpThrottle, Admin } = models;
export const { business } = await import('../../src/config/business.js');
export const { addDays, salonNow } = await import('../../src/utils/schedule.js');
export const { env } = await import('../../src/config/env.js');
export const { signToken } = await import('../../src/middleware/auth.js');

export const app = createApp();

// ---- mail capture ----
export const mails = [];
export const mode = { failIf: null, onSend: null }; // failIf(message) -> true makes delivery throw
mailTransport.send = async (message) => {
  if (mode.failIf?.(message)) throw Object.assign(new Error('simulated SMTP outage'), { code: 'ECONNECTION' });
  if (mode.onSend) await mode.onSend(message);
  mails.push(message);
};

// ---- capture console output so tests can prove codes are never logged ----
export const logged = [];
for (const k of ['log', 'error', 'warn', 'info']) {
  const original = console[k].bind(console);
  console[k] = (...args) => { logged.push(args.map(String).join(' ')); original(...args); };
}

export async function connect() {
  await mongoose.connect(uri);
  // Some MongoDB-compatible servers used for local testing do not implement TTL indexes
  // (real MongoDB does). Ignore only that error; every other index error must surface.
  await Promise.all(Object.values(models).map((m) => m.init().catch((e) => { if (!/expireAfterSeconds/.test(e.message)) throw e; })));

}
export const disconnect = () => mongoose.disconnect();

export async function reset() {
  await Promise.all([Appointment, SlotLock, EmailVerification, OtpThrottle, Admin].map((m) => m.deleteMany({})));
  mails.length = 0;
  logged.length = 0;
  mode.failIf = null;
  mode.onSend = null;
}

export async function makeService(over = {}) {
  await Service.deleteMany({});
  return Service.create({ name: 'Test Manicure', description: 'Test service', price: 350, durationMinutes: 60, category: 'nail-services', ...over });
}

// ---- helpers that behave like a customer ----
export const futureDate = (days = 7) => addDays(salonNow(business.timezone).date, days);
export const codeFor = (email) => {
  const mail = [...mails].reverse().find((m) => m.to === email && /verification code/i.test(m.subject));
  return mail ? mail.text.match(/\b(\d{6})\b/)[1] : null;
};
export const requestCode = (email) => request(app).post('/api/verification/email/request').send({ email });
export const verifyCode = (email, code) => request(app).post('/api/verification/email/verify').send({ email, code });

/** Full happy path: request a code, read it from the captured email, verify. Returns the authorization token. */
export async function tokenFor(email) {
  await OtpThrottle.deleteMany({ email }); // test convenience only; the cooldown has its own tests
  const sent = await requestCode(email);
  if (sent.status !== 202) throw new Error(`code request failed: ${sent.status} ${JSON.stringify(sent.body)}`);
  const res = await verifyCode(email, codeFor(email));
  if (res.status !== 200) throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.verificationToken;
}

export const bookingBody = (service, over = {}) => ({
  serviceId: String(service._id), date: futureDate(), time: '12:00', customerName: 'Jane Doe',
  email: 'jane@example.com', phone: '0917 123 4567', ...over,
});
export const book = (body) => request(app).post('/api/appointments').send(body);
