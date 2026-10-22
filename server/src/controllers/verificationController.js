import { EmailVerification } from '../models/EmailVerification.js';
import { OtpThrottle } from '../models/OtpThrottle.js';
import { verification as policy } from '../config/verification.js';
import { AppError } from '../utils/AppError.js';
import { emailConfigured, sendOtpEmail } from '../utils/mailer.js';
import { generateAuthToken, generateOtp, hashAuthToken, hashOtp, safeEqualHex } from '../utils/otp.js';
import { emailOnlyBody, verifyCodeBody } from '../utils/validators.js';

/** POST /api/verification/email/request  { email }  ->  202, a six-digit code is emailed. */
export async function requestCode(req, res) {
  const { email } = emailOnlyBody.parse(req.body);
  if (!emailConfigured()) {
    throw new AppError(503, 'Email verification is temporarily unavailable. Please contact the salon to book.', undefined, 'EMAIL_NOT_CONFIGURED');
  }
  const now = new Date();

  // Cap per address per hour
  const recent = await EmailVerification.countDocuments({ email, createdAt: { $gt: new Date(now - 60 * 60 * 1000) } });
  if (recent >= policy.maxSendsPerHour) {
    throw new AppError(429, 'Too many codes were requested for this email. Please try again in an hour.', { retryAfterSeconds: 3600 }, 'TOO_MANY_REQUESTS');
  }

  // 60-second cooldown, decided atomically by the unique index on OtpThrottle.email:
  // when a throttle row exists and is not yet due, the upsert collides (E11000).
  try {
    await OtpThrottle.findOneAndUpdate(
      { email, nextAllowedAt: { $lte: now } },
      { $set: { nextAllowedAt: new Date(now.getTime() + policy.resendCooldownMs) } },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const t = await OtpThrottle.findOne({ email }).lean();
    const wait = Math.max(1, Math.ceil(((t?.nextAllowedAt?.getTime() || now.getTime()) - now.getTime()) / 1000));
    throw new AppError(429, `Please wait ${wait} seconds before requesting another code.`, { retryAfterSeconds: wait }, 'COOLDOWN');
  }

  const code = generateOtp();
  const record = new EmailVerification({ email, codeHash: 'pending', expiresAt: new Date(now.getTime() + policy.otpTtlMs) });
  record.codeHash = hashOtp(record._id, email, code);
  await record.save();

  const result = await sendOtpEmail(email, code);
  if (result.status !== 'sent') {
    // Nothing was delivered: discard the code and release the cooldown so the customer can retry.
    await EmailVerification.deleteOne({ _id: record._id });
    await OtpThrottle.updateOne({ email }, { $set: { nextAllowedAt: now } });
    throw new AppError(502, 'We could not send the verification email. Please check the address and try again.', undefined, 'EMAIL_SEND_FAILED');
  }

  // Only now do older unused codes stop working: exactly one pending code per address.
  await EmailVerification.updateMany({ email, status: 'pending', _id: { $ne: record._id } }, { $set: { status: 'superseded' } });

  res.status(202).json({
    success: true,
    message: 'Verification code sent.',
    data: { expiresInSeconds: policy.otpTtlMs / 1000, cooldownSeconds: policy.resendCooldownMs / 1000 },
  });
}

async function explainFailure(email, now) {
  const latest = await EmailVerification.findOne({ email }).sort({ createdAt: -1 }).lean();
  if (!latest) return new AppError(400, 'No code was requested for this email. Request a code first.', undefined, 'NO_CODE');
  if (['verified', 'consumed'].includes(latest.status)) {
    return new AppError(409, 'This code has already been used. Request a new code if you need to verify again.', undefined, 'CODE_ALREADY_USED');
  }
  if (latest.status === 'superseded') return new AppError(400, 'A newer code was sent. Use the latest code.', undefined, 'CODE_SUPERSEDED');
  if (latest.expiresAt <= now) return new AppError(410, 'Verification code expired. Please request a new code.', undefined, 'CODE_EXPIRED');
  if (latest.attempts >= policy.maxAttempts) {
    return new AppError(429, 'Too many incorrect attempts. Please request a new code.', undefined, 'TOO_MANY_ATTEMPTS');
  }
  return new AppError(400, 'This code is no longer valid. Please request a new code.', undefined, 'NO_CODE');
}

/** POST /api/verification/email/verify  { email, code }  ->  { verificationToken } */
export async function verifyCode(req, res) {
  const { email, code } = verifyCodeBody.parse(req.body);
  const now = new Date();

  // Count the attempt BEFORE comparing, in the same update that selects the active code.
  const record = await EmailVerification.findOneAndUpdate(
    { email, status: 'pending', expiresAt: { $gt: now }, attempts: { $lt: policy.maxAttempts } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { createdAt: -1 } }
  );
  if (!record) throw await explainFailure(email, now);

  if (!safeEqualHex(record.codeHash, hashOtp(record._id, email, code))) {
    const remaining = policy.maxAttempts - record.attempts;
    if (remaining <= 0) throw new AppError(429, 'Too many incorrect attempts. Please request a new code.', undefined, 'TOO_MANY_ATTEMPTS');
    throw new AppError(400, `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`, { attemptsRemaining: remaining }, 'INVALID_CODE');
  }

  // Correct code: switch pending -> verified exactly once and issue the booking authorization.
  const token = generateAuthToken();
  const done = await EmailVerification.updateOne(
    { _id: record._id, status: 'pending' },
    { $set: { status: 'verified', verifiedAt: now, authExpiresAt: new Date(now.getTime() + policy.authTtlMs), tokenHash: hashAuthToken(token) } }
  );
  if (done.modifiedCount !== 1) throw new AppError(409, 'This code has already been used.', undefined, 'CODE_ALREADY_USED');

  res.json({
    success: true,
    message: 'Email verified.',
    data: { verified: true, email, verificationToken: token, expiresInSeconds: policy.authTtlMs / 1000 },
  });
}
