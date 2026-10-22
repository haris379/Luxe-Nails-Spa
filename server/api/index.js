import { createApp } from "../src/createApp.js";
import { assertRuntimeEnv } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { Appointment } from "../src/models/Appointment.js";
import { SlotLock } from "../src/models/SlotLock.js";
import { EmailVerification } from "../src/models/EmailVerification.js";
import { OtpThrottle } from "../src/models/OtpThrottle.js";

const app = createApp();
let ready;

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
      ready = undefined;
      throw err;
    });
  }

  return ready;
}

export default async function handler(req, res) {
  try {
    await init();
  } catch (err) {
    console.error("Backend initialization failed:", err);

    return res.status(500).json({
      success: false,
      message: "Server initialization failed.",
    });
  }

  return app(req, res);
}
