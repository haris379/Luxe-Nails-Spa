import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    // Only documents in this collection can ever hold an admin session.
    // "admin" = business owner, "developer" = website maintenance. Set only by the seed / create-developer
    // scripts; no API can change it. Older documents without these fields behave as role "admin", tokenVersion 0.
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    // Incremented on logout so every token issued earlier stops working server-side.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Admin = mongoose.model('Admin', adminSchema);
