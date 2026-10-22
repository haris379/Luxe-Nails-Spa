import { z } from 'zod';
import { DATE_RE, isValidDateStr } from './schedule.js';
import { APPOINTMENT_STATUSES } from '../models/Appointment.js';
import { CATEGORY_IDS } from './categories.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const cleanText = (min, max, label) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .transform((s) => s.replace(/[<>]/g, ''));

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(120)
  .email('Enter a valid email address');

// FormData sends booleans as the strings "true"/"false"; z.coerce.boolean() would turn "false" into true.
const boolish = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

const phone = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number')
  .refine((v) => v.replace(/\D/g, '').length >= 7, 'Enter a valid phone number');

const dateStr = z
  .string({ required_error: 'Date is required' })
  .regex(DATE_RE, 'Date must be YYYY-MM-DD')
  .refine(isValidDateStr, 'Enter a valid date');

export const emailOnlyBody = z.object({ email });
export const verifyCodeBody = z.object({
  email,
  code: z.string({ required_error: 'Enter the 6-digit code' }).trim().regex(/^\d{6}$/, 'The code is 6 digits'),
});

export const availabilityQuery = z.object({
  serviceId: objectId,
  date: dateStr,
  technicianId: z.string().trim().max(30).optional(),
});

export const createAppointmentBody = z.object({
  serviceId: objectId,
  date: dateStr,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time'),
  technicianId: z.string().trim().max(30).optional(),
  // Presence and validity are enforced in the controller (403), not here, so the client cannot
  // learn anything from a 400 and an absent token never reaches the slot logic.
  verificationToken: z.unknown().optional(),
  customerName: cleanText(2, 80, 'Full name'),
  email,
  phone,
  notes: z.string().trim().max(500, 'Notes must be at most 500 characters').optional().default('')
    .transform((s) => s.replace(/[<>]/g, '')),
});

export const contactBody = z.object({
  name: cleanText(2, 100, 'Name'),
  email,
  subject: cleanText(3, 150, 'Subject'),
  message: cleanText(10, 2000, 'Message'),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const statusBody = z.object({ status: z.enum(APPOINTMENT_STATUSES) });

export const appointmentFilter = z.object({
  date: dateStr.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
});

export const serviceBody = z.object({
  name: cleanText(2, 80, 'Name'),
  description: cleanText(5, 400, 'Description'),
  price: z.coerce.number({ invalid_type_error: 'Price must be a number' }).min(0).max(1000000),
  isStartingPrice: boolish.optional().default(false),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  image: z.string().trim().max(300).optional(), // omitted = keep the current image (update) / none (create)
  category: z.enum(CATEGORY_IDS, { errorMap: () => ({ message: 'Choose a valid category' }) }).default('nail-services'),
  active: boolish.optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export { objectId };

export const serviceListQuery = z.object({ category: z.enum(CATEGORY_IDS).optional() });
