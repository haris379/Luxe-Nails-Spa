// Email-verification policy. Change here, not in the controllers.
export const verification = {
  otpTtlMs: 10 * 60 * 1000, // a code is valid for 10 minutes
  resendCooldownMs: 60 * 1000, // minimum gap between codes for one address
  maxAttempts: 5, // wrong guesses allowed per code
  maxSendsPerHour: 5, // codes per address per hour
  authTtlMs: 30 * 60 * 1000, // after verifying, the booking authorization lasts 30 minutes
  retentionMs: 7 * 24 * 60 * 60 * 1000, // records are purged after 7 days
};
