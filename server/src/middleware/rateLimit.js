import rateLimit from 'express-rate-limit';

// DISABLE_RATE_LIMIT=true is for automated tests only.
const skip = () => process.env.DISABLE_RATE_LIMIT === 'true';

const make = (windowMs, limit, message) =>
  rateLimit({
    skip,
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
  });

export const apiLimiter = make(15 * 60 * 1000, 300, 'Too many requests. Please try again later.');
export const loginLimiter = make(15 * 60 * 1000, 10, 'Too many login attempts. Please try again in 15 minutes.');
export const submitLimiter = make(60 * 60 * 1000, 20, 'Too many submissions. Please try again later.');
// Email verification: per IP. Per-address limits (cooldown, hourly cap, attempts) live in the controller.
export const otpRequestLimiter = make(60 * 60 * 1000, 10, 'Too many verification requests. Please try again later.');
export const otpVerifyLimiter = make(15 * 60 * 1000, 30, 'Too many verification attempts. Please try again later.');
