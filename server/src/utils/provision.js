import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Admin } from '../models/Admin.js';

const emailSchema = z.string().trim().toLowerCase().email().max(120);
export const MIN_DEVELOPER_PASSWORD = 12;

/**
 * Creates (or resets the password of) the developer account. This is the ONLY way a developer
 * account comes into existence: there is no API, no registration page, no request field for it.
 * It refuses to touch the business admin's account, so the two can never be mixed up.
 * Returns { action: 'created' | 'password-updated' }.
 */
export async function provisionDeveloper(rawEmail, password) {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new Error('Enter a valid email address.');
  const email = parsed.data;
  if (typeof password !== 'string' || password.length < MIN_DEVELOPER_PASSWORD) {
    throw new Error(`The password must be at least ${MIN_DEVELOPER_PASSWORD} characters.`);
  }
  if (password.toLowerCase().includes(email.split('@')[0]) && email.split('@')[0].length >= 4) {
    throw new Error('The password must not contain the email name.');
  }

  const existing = await Admin.findOne({ email });
  if (existing && (existing.role ?? 'admin') !== 'developer') {
    throw new Error('That email already belongs to the business admin account. Use a different email for the developer account.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1; // signs out any existing developer sessions
    await existing.save();
    return { action: 'password-updated', email };
  }
  await Admin.create({ email, passwordHash, role: 'developer' });
  return { action: 'created', email };
}
