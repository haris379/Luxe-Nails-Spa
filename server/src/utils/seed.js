import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { assertRuntimeEnv } from "../config/env.js";
import { connectDB } from "../config/db.js";
import { Service } from "../models/Service.js";
import { Admin } from "../models/Admin.js";
import { syncCatalog } from "./serviceCatalog.js";

async function run() {
  assertRuntimeEnv();
  await connectDB();

  const r = await syncCatalog(Service);
  console.log(
    `Service catalogue synced: ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged`,
  );

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || password.length < 10) {
    console.log(
      "Skipping admin creation: set ADMIN_EMAIL and an ADMIN_PASSWORD of 10+ characters in .env",
    );
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await Admin.findOne({ email });
    if (existing && existing.role === "developer") {
      console.log(
        `Skipping ${email}: that email is the developer account. Use a different ADMIN_EMAIL for the business admin.`,
      );
    } else if (existing) {
      existing.passwordHash = passwordHash;
      await existing.save();
      console.log(`Updated password for admin ${email}`);
    } else {
      await Admin.create({ email, passwordHash, role: "admin" });
      console.log(`Created admin ${email}`);
    }
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
