import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { Appointment } from '../models/Appointment.js';
import { SlotLock } from '../models/SlotLock.js';
import { Service } from '../models/Service.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { adminStore, signToken } from '../middleware/auth.js';
import { isRole, permissionsFor } from '../config/permissions.js';
import { sendBookingEmail } from '../utils/mailer.js';
import { recordEmailResult } from '../utils/notifications.js';
import { AppError } from '../utils/AppError.js';
import { formatTime } from '../utils/schedule.js';
import { categoryGroup, categoryLabel, normalizeCategory, CATEGORY_IDS } from '../utils/categories.js';
import { slugify } from '../utils/serviceCatalog.js';
import { removeImageIfUnused, removeUploadedFile, saveServiceImage } from '../utils/uploads.js';
import { loginBody, statusBody, appointmentFilter, serviceBody, objectId } from '../utils/validators.js';

// Pre-computed hash so login timing doesn't reveal whether an email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function login(req, res) {
  const { email, password } = loginBody.parse(req.body);
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, admin?.passwordHash || DUMMY_HASH);
  const role = admin?.role ?? 'admin';
  if (!admin || !ok || !isRole(role)) throw new AppError(401, 'Incorrect email or password.');
  res.json({ success: true, data: { token: signToken({ _id: admin._id, email: admin.email, role, tokenVersion: admin.tokenVersion }), email: admin.email, role, permissions: permissionsFor(role) } });
}

export function me(req, res) {
  // Reaching this handler means requireAdmin re-verified the admin against the database.
  res.json({ success: true, data: { email: req.admin.email, role: req.admin.role, permissions: req.admin.permissions } });
}

// Invalidates every token issued to this admin, so a copied token stops working immediately.
export async function logout(req, res) {
  await adminStore.bumpTokenVersion(req.admin.id);
  res.json({ success: true, message: 'Signed out.' });
}

const withLabel = (a) => ({
  ...a,
  timeLabel: formatTime(a.startMinutes),
  serviceCategory: normalizeCategory(a.serviceCategory),
  categoryLabel: categoryLabel(a.serviceCategory),
  treatmentType: categoryGroup(a.serviceCategory), // 'nail' | 'spa'
  emailVerified: a.emailVerified === true, // false for bookings made before verification existed
  bookingEmail: { status: a.bookingEmail?.status || 'not_sent', attempts: a.bookingEmail?.attempts || 0 },
  confirmedEmail: { status: a.confirmedEmail?.status || 'not_sent', attempts: a.confirmedEmail?.attempts || 0 },
});

export async function listAppointments(req, res) {
  const filter = appointmentFilter.parse(req.query);
  const query = {};
  if (filter.date) query.date = filter.date;
  if (filter.status) query.status = filter.status;
  if (filter.category) {
    // Bookings made before categories existed have no serviceCategory: they are nail bookings.
    query.$and = [filter.category === 'nail-services'
      ? { $or: [{ serviceCategory: 'nail-services' }, { serviceCategory: { $exists: false } }] }
      : { serviceCategory: filter.category }];
  }
  const items = await Appointment.find(query).sort({ date: 1, startMinutes: 1 }).limit(500).lean();
  res.json({ success: true, data: items.map(withLabel) });
}

const TRANSITIONS = {
  pending: ['confirmed', 'cancelled', 'completed'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function updateAppointmentStatus(req, res) {
  const id = objectId.parse(req.params.id);
  const { status } = statusBody.parse(req.body);
  const appt = await Appointment.findById(id);
  if (!appt) throw new AppError(404, 'Appointment not found.');
  if (status !== appt.status && !TRANSITIONS[appt.status].includes(status)) {
    throw new AppError(400, `A ${appt.status} appointment cannot be changed to ${status}.`);
  }
  // A booking can only be confirmed if the customer proved they own the email address.
  if (status === 'confirmed' && appt.emailVerified !== true) {
    throw new AppError(409, "This booking's email address was never verified, so it cannot be confirmed. Cancel it and ask the customer to book again.", undefined, 'EMAIL_NOT_VERIFIED');
  }
  appt.status = status;
  await appt.save();
  // Cancelling frees the technician's time slots.
  if (status === 'cancelled') await SlotLock.deleteMany({ appointment: appt._id });
  // Tell the customer when the salon confirms. A delivery failure never undoes the confirmation:
  // it is recorded so the admin can retry.
  if (status === 'confirmed') {
    const result = await sendBookingEmail(appt);
    await recordEmailResult(appt._id, 'confirmedEmail', result);
  }
  const fresh = await Appointment.findById(appt._id).lean();
  res.json({ success: true, data: withLabel(fresh) });
}

// Retry the booking email for the current status. Only ever sent to a verified address.
export async function resendAppointmentEmail(req, res) {
  const id = objectId.parse(req.params.id);
  const appt = await Appointment.findById(id);
  if (!appt) throw new AppError(404, 'Appointment not found.');
  if (appt.emailVerified !== true) throw new AppError(409, 'This booking has no verified email address, so no email can be sent.', undefined, 'EMAIL_NOT_VERIFIED');
  if (!['pending', 'confirmed'].includes(appt.status)) throw new AppError(400, 'No email is sent for this status.');
  const result = await sendBookingEmail(appt);
  await recordEmailResult(appt._id, appt.status === 'confirmed' ? 'confirmedEmail' : 'bookingEmail', result);
  const fresh = await Appointment.findById(appt._id).lean();
  res.json({ success: true, message: result.status === 'sent' ? 'Email sent.' : 'The email could not be sent. Check the email settings.', data: withLabel(fresh) });
}

export async function listAllServices(req, res) {
  const items = await Service.find().sort({ sortOrder: 1, name: 1 }).lean();
  res.json({ success: true, data: items.map((s) => ({ ...s, category: normalizeCategory(s.category) })) });
}

async function uniqueSlug(name) {
  const base = slugify(name) || 'service';
  let slug = base;
  for (let n = 2; await Service.exists({ slug }); n += 1) slug = `${base}-${n}`;
  return slug;
}

export async function createService(req, res) {
  const body = serviceBody.parse(req.body); // validate first so nothing is written for invalid input
  let uploaded = null;
  try {
    if (req.file) uploaded = await saveServiceImage(req.file.buffer);
    const image = uploaded ?? body.image ?? '';
    const created = await Service.create({ ...body, image, slug: await uniqueSlug(body.name) });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (uploaded) await removeUploadedFile(uploaded); // don't leave an orphan if saving failed
    throw err;
  }
}

export async function updateService(req, res) {
  const id = objectId.parse(req.params.id);
  const body = serviceBody.parse(req.body);
  const existing = await Service.findById(id).lean();
  if (!existing) throw new AppError(404, 'Service not found.');

  let uploaded = null;
  try {
    if (req.file) uploaded = await saveServiceImage(req.file.buffer);
    const patch = { ...body };
    delete patch.image;
    if (uploaded) patch.image = uploaded; // a new upload wins
    else if (body.image !== undefined) patch.image = body.image; // manual path edit
    // (image omitted entirely -> the stored image is left untouched)

    const updated = await Service.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!updated) throw new AppError(404, 'Service not found.');

    // Only after the database accepted the change is it safe to drop the replaced file.
    if (existing.image && existing.image !== updated.image) await removeImageIfUnused(existing.image, id);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (uploaded) await removeUploadedFile(uploaded); // the old image stays exactly as it was
    throw err;
  }
}

export async function deleteService(req, res) {
  const id = objectId.parse(req.params.id);
  const inUse = await Appointment.exists({ service: id, status: { $in: ['pending', 'confirmed'] } });
  if (inUse) {
    throw new AppError(409, 'This service has upcoming appointments. Mark it inactive instead of deleting it.');
  }
  const deleted = await Service.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, 'Service not found.');
  if (deleted.image) await removeImageIfUnused(deleted.image, id);
  res.json({ success: true, message: 'Service deleted.' });
}

export async function listMessages(req, res) {
  const items = await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: items });
}

export async function markMessageRead(req, res) {
  const id = objectId.parse(req.params.id);
  const msg = await ContactMessage.findByIdAndUpdate(id, { read: true }, { new: true });
  if (!msg) throw new AppError(404, 'Message not found.');
  res.json({ success: true, data: msg });
}
