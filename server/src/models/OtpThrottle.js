import mongoose from 'mongoose';
import { verification } from '../config/verification.js';

// One document per email. The unique index lets the database itself decide which of two
// simultaneous "send me a code" requests wins, so the cooldown cannot be raced.
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  nextAllowedAt: { type: Date, required: true },
  purgeAt: { type: Date, default: () => new Date(Date.now() + verification.retentionMs), index: { expireAfterSeconds: 0 } },
});

export const OtpThrottle = mongoose.model('OtpThrottle', schema);
