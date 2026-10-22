import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  // Key for hashing one-time codes. Falls back to JWT_SECRET when not set.
  otpSecret: process.env.OTP_SECRET || "",
  // Where uploaded images are stored. Defaults to server/uploads. Point this at a persistent disk in production.
  uploadDir: process.env.UPLOAD_DIR || "",
  // Store uploaded images in MongoDB instead of on disk. Automatic on Vercel (no persistent disk there).
  dbUploads: process.env.UPLOAD_STORAGE === "db" || Boolean(process.env.VERCEL),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "",
    owner: process.env.OWNER_EMAIL || "",
  },
};

export function assertRuntimeEnv() {
  const problems = [];
  if (!env.mongoUri) problems.push("MONGODB_URI is required");
  if (env.jwtSecret.length < 32)
    problems.push("JWT_SECRET must be at least 32 characters");
  if (env.otpSecret && env.otpSecret.length < 32)
    problems.push("OTP_SECRET must be at least 32 characters when set");
  if (problems.length) {
    throw new Error(
      `Invalid environment configuration:\n- ${problems.join("\n- ")}`,
    );
  }
}
