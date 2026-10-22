import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = () => env.otpSecret || env.jwtSecret;

/** Cryptographically secure six-digit code (000000-999999). */
export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Codes are stored only as an HMAC bound to the record id and email, never in plaintext.
 * A leaked database therefore cannot be replayed against another record or address,
 * and the small six-digit space cannot be brute-forced offline without the secret key.
 */
export function hashOtp(recordId, email, code) {
  return crypto.createHmac('sha256', key()).update(`otp:${recordId}:${email}:${code}`).digest('hex');
}

export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** Random, unguessable booking authorization handed to the browser once after a successful check. */
export const generateAuthToken = () => crypto.randomBytes(32).toString('base64url');
export const hashAuthToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
