export class AppError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code; // short machine-readable reason, e.g. EMAIL_NOT_VERIFIED
  }
}
