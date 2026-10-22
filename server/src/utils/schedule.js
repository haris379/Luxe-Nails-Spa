// Pure scheduling helpers (no database access) so they can be unit tested.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Current date (YYYY-MM-DD) and minutes-since-midnight in the salon's timezone. */
export function salonNow(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Time a service occupies, rounded up to whole slots. */
export function blockedMinutes(durationMinutes, slotMinutes) {
  return Math.ceil(durationMinutes / slotMinutes) * slotMinutes;
}

/** Slot start times (minutes) that a booking starting at `start` occupies. */
export function slotsFor(start, durationMinutes, slotMinutes) {
  const total = blockedMinutes(durationMinutes, slotMinutes);
  const out = [];
  for (let t = start; t < start + total; t += slotMinutes) out.push(t);
  return out;
}

/**
 * All bookable start times for a date and service duration, ignoring existing
 * bookings. Returns [] for closed days, past dates and dates too far ahead.
 */
export function candidateStarts({ dateStr, durationMinutes, business, now = new Date() }) {
  if (!isValidDateStr(dateStr)) return [];
  const today = salonNow(business.timezone, now);
  if (dateStr < today.date) return [];
  if (dateStr > addDays(today.date, business.maxAdvanceDays)) return [];

  const hours = business.hours[dayOfWeek(dateStr)];
  if (!hours) return [];
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const block = blockedMinutes(durationMinutes, business.slotMinutes);

  const starts = [];
  for (let t = open; t + block <= close; t += business.slotMinutes) {
    if (dateStr === today.date && t < today.minutes + business.minLeadMinutes) continue;
    starts.push(t);
  }
  return starts;
}

/**
 * busy: Map<technicianId, Set<slotStartMinutes>>
 * Returns technician ids that are free for every slot of this booking.
 */
export function freeTechnicians({ start, durationMinutes, technicianIds, busy, slotMinutes }) {
  const needed = slotsFor(start, durationMinutes, slotMinutes);
  return technicianIds.filter((id) => {
    const taken = busy.get(id);
    return !taken || needed.every((s) => !taken.has(s));
  });
}
