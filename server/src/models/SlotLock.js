import mongoose from 'mongoose';

// One document per technician per 30-minute slot. The unique index makes
// double-booking impossible even when two requests arrive at the same time.
const slotLockSchema = new mongoose.Schema({
  technicianId: { type: String, required: true },
  date: { type: String, required: true },
  slot: { type: Number, required: true }, // slot start in minutes since midnight
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
});

slotLockSchema.index({ technicianId: 1, date: 1, slot: 1 }, { unique: true });
slotLockSchema.index({ appointment: 1 });

export const SlotLock = mongoose.model('SlotLock', slotLockSchema);
