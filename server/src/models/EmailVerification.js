import mongoose from 'mongoose';
import { verification } from '../config/verification.js';

// One record per code that was sent.
//   pending    code sent, not yet entered correctly
//   verified   address proven; tokenHash is the booking authorization
//   consumed   authorization used by a booking
//   superseded replaced by a newer code
//   revoked    cancelled by the system
const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true }, // normalized: trimmed + lowercase
    codeHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'verified', 'consumed', 'superseded', 'revoked'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }, // code expiry
    verifiedAt: Date,
    tokenHash: { type: String, unique: true, sparse: true }, // sha256 of the authorization token
    authExpiresAt: Date, // authorization expiry
    consumedAt: Date,
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    purgeAt: { type: Date, default: () => new Date(Date.now() + verification.retentionMs), index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);
schema.index({ email: 1, createdAt: -1 });

export const EmailVerification = mongoose.model('EmailVerification', schema);
