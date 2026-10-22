import test from 'node:test';
import assert from 'node:assert/strict';
import { business } from '../src/config/business.js';
import {
  candidateStarts, freeTechnicians, slotsFor, blockedMinutes, isValidDateStr, salonNow, formatTime, addDays,
} from '../src/utils/schedule.js';

// Fixed "now": 2026-10-09 10:00 in Manila (UTC+8) = 02:00 UTC
const NOW = new Date('2026-10-09T02:00:00Z');

test('salonNow converts to the salon timezone', () => {
  assert.deepEqual(salonNow('Asia/Manila', NOW), { date: '2026-10-09', minutes: 600 });
});

test('isValidDateStr rejects impossible dates', () => {
  assert.equal(isValidDateStr('2026-02-30'), false);
  assert.equal(isValidDateStr('2026-10-09'), true);
  assert.equal(isValidDateStr('10/09/2026'), false);
});

test('past dates have no slots', () => {
  assert.deepEqual(candidateStarts({ dateStr: '2026-10-08', durationMinutes: 45, business, now: NOW }), []);
});

test('same-day slots respect the lead time', () => {
  const starts = candidateStarts({ dateStr: '2026-10-09', durationMinutes: 30, business, now: NOW });
  assert.equal(starts[0], 11 * 60); // 10:00 now + 60 min lead
});

test('last slot ends by closing time (Sunday closes 18:00, 2h service)', () => {
  const sunday = '2026-10-11';
  const starts = candidateStarts({ dateStr: sunday, durationMinutes: 120, business, now: NOW });
  assert.equal(starts[0], 11 * 60);
  assert.equal(starts.at(-1), 16 * 60);
});

test('dates beyond the advance window are rejected', () => {
  const far = addDays('2026-10-09', business.maxAdvanceDays + 1);
  assert.deepEqual(candidateStarts({ dateStr: far, durationMinutes: 30, business, now: NOW }), []);
});

test('45-minute services block two 30-minute slots', () => {
  assert.equal(blockedMinutes(45, 30), 60);
  assert.deepEqual(slotsFor(540, 45, 30), [540, 570]);
});

test('freeTechnicians detects overlaps', () => {
  const busy = new Map([['ana', new Set([570])]]);
  const free = freeTechnicians({ start: 540, durationMinutes: 45, technicianIds: ['ana', 'bea'], busy, slotMinutes: 30 });
  assert.deepEqual(free, ['bea']);
  const none = freeTechnicians({ start: 540, durationMinutes: 45, technicianIds: ['ana'], busy, slotMinutes: 30 });
  assert.deepEqual(none, []);
});

test('formatTime', () => {
  assert.equal(formatTime(540), '9:00 AM');
  assert.equal(formatTime(0), '12:00 AM');
  assert.equal(formatTime(13 * 60 + 30), '1:30 PM');
});
