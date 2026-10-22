import { createApp } from './createApp.js';
import { env, assertRuntimeEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureUploadDirs } from './utils/uploads.js';
import { Appointment } from './models/Appointment.js';
import { SlotLock } from './models/SlotLock.js';
import { EmailVerification } from './models/EmailVerification.js';
import { OtpThrottle } from './models/OtpThrottle.js';

async function start() {
  assertRuntimeEnv();
  await ensureUploadDirs();
  await connectDB();
  // The booking rules rely on unique indexes (slot locks, one booking per verification, cooldown),
  // so make sure they exist before serving requests.
  await Promise.all([Appointment.init(), SlotLock.init(), EmailVerification.init(), OtpThrottle.init()]);
  const app = createApp();
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
