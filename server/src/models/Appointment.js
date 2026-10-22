import mongoose from 'mongoose';

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const emailNoticeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['not_sent', 'sent', 'failed', 'not_configured'], default: 'not_sent' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
    lastError: { type: String, default: '' }, // short error code only, never message content
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },
    serviceCategory: { type: String, default: 'nail-services' }, // missing on pre-spa bookings = nail
    servicePrice: { type: Number, required: true },
    isStartingPrice: { type: Boolean, default: false },
    durationMinutes: { type: Number, required: true },
    technicianId: { type: String, required: true },
    technicianName: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // salon-local date
    startMinutes: { type: Number, required: true },
    endMinutes: { type: Number, required: true },
    customerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'pending' },
    // Email ownership proof. Bookings made before verification existed have emailVerified=false
    // and cannot be confirmed. The unique sparse index means one verification can back at most one booking.
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    verification: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailVerification', unique: true, sparse: true },
    // Delivery record for the two emails we send about a booking
    bookingEmail: { type: emailNoticeSchema, default: () => ({}) },
    confirmedEmail: { type: emailNoticeSchema, default: () => ({}) },
  },
  { timestamps: true }
);

appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ createdAt: -1 });
appointmentSchema.index({ serviceCategory: 1, date: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
