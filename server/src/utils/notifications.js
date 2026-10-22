import { Appointment } from '../models/Appointment.js';

/** Stores the outcome of an email attempt on the appointment ("bookingEmail" or "confirmedEmail"). */
export function recordEmailResult(appointmentId, field, result) {
  return Appointment.updateOne(
    { _id: appointmentId },
    {
      $set: { [`${field}.status`]: result.status, [`${field}.lastAttemptAt`]: new Date(), [`${field}.lastError`]: result.error || '' },
      $inc: { [`${field}.attempts`]: 1 },
    }
  );
}
