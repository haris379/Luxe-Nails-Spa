// Vercel serverless entry point. Every request (see vercel.json) is routed here.
import { createApp } from "../src/app.js";
import { assertRuntimeEnv } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { Appointment } from "../src/models/Appointment.js";
import { SlotLock } from "../src/models/SlotLock.js";
import { EmailVerification } from "../src/models/EmailVerification.js";
import { OtpThrottle } from "../src/models/OtpThrottle.js";

const app = createApp();
let ready; // the connection is created once per warm instance and reused

function init() {
  if (!ready) {
    ready = (async () => {
      assertRuntimeEnv();
      await connectDB();
      await Promise.all([
        Appointment.init(),
        SlotLock.init(),
        EmailVerification.init(),
        OtpThrottle.init(),
      ]);
    })().catch((err) => {
      ready = undefined; // retry on the next request
      throw err;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  try {
    await init();
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Server is not configured correctly." });
  }
  return app(req, res);
}

   export { default } from "../src/app.js";
