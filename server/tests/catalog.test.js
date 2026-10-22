import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, syncCatalog, validateCatalog } from '../src/utils/serviceCatalog.js';
import { CATEGORY_IDS, normalizeCategory, categoryGroup } from '../src/utils/categories.js';
import { buildBookingEmail } from '../src/utils/mailer.js';

const names = (cat) => catalog.filter((s) => s.category === cat).map((s) => s.name);

test('catalogue is valid and slugs are unique', () => {
  assert.deepEqual(validateCatalog(), []);
});

test('every requested spa service exists in the right category', () => {
  const expected = {
    massage: ['Relaxation Massage', 'Swedish Massage', 'Deep Tissue Massage', 'Aromatherapy Massage', 'Hot Stone Massage', 'Back, Neck and Shoulder Massage'],
    facial: ['Classic Facial', 'Deep Cleansing Facial', 'Hydrating Facial', 'Brightening Facial', 'Anti-Aging Facial', 'Express Facial'],
    body: ['Body Scrub', 'Body Polish', 'Body Wrap', 'Exfoliating Body Treatment', 'Hydrating Body Treatment'],
    waxing: ['Full Arms Waxing', 'Half Arms Waxing', 'Full Legs Waxing', 'Half Legs Waxing', 'Underarms Waxing', 'Facial Waxing', 'Full Body Waxing'],
    'hand-foot-spa': ['Luxury Manicure', 'Foot Soak and Scrub', 'Hand Spa Treatment', 'Paraffin Hand Treatment', 'Paraffin Foot Treatment'],
  };
  for (const [cat, list] of Object.entries(expected)) for (const n of list) assert.ok(names(cat).includes(n), `${cat}: ${n}`);
});

test('existing nail services are kept and not duplicated by spa ones', () => {
  for (const n of ['Classic Manicure', 'Gel Polish Manicure', 'Acrylic Full Set', 'Custom Nail Art', 'Gel Extensions', 'Polish Change']) {
    assert.ok(names('nail-services').includes(n), n);
  }
  const all = catalog.map((s) => s.name);
  assert.equal(new Set(all).size, all.length);
});

test('category helpers', () => {
  assert.equal(normalizeCategory('nails'), 'nail-services');
  assert.equal(normalizeCategory(undefined), 'nail-services');
  assert.equal(categoryGroup('massage'), 'spa');
  assert.equal(categoryGroup('nail-services'), 'nail');
});

// Minimal in-memory stand-in for the Mongoose model, enough to verify the sync logic.
function fakeModel(initial = []) {
  const docs = initial.map((d, i) => ({ _id: String(i + 1), ...d }));
  let id = docs.length;
  return {
    docs,
    find: () => ({ lean: async () => docs.map((d) => ({ ...d })) }),
    create: async (d) => { docs.push({ _id: String(++id), ...d }); },
    updateOne: async ({ _id }, { $set }) => Object.assign(docs.find((d) => d._id === _id), $set),
  };
}

test('sync is idempotent: second run creates nothing', async () => {
  const M = fakeModel();
  const first = await syncCatalog(M);
  assert.equal(first.created, catalog.length);
  const second = await syncCatalog(M);
  assert.deepEqual(second, { created: 0, updated: 0, unchanged: catalog.length });
  assert.equal(M.docs.length, catalog.length);
});

test('sync migrates legacy services without duplicating or overwriting admin edits', async () => {
  const M = fakeModel([
    { name: 'Classic Manicure', description: 'edited', price: 999, durationMinutes: 50, category: 'nails', active: false },
    { name: 'Luxury Spa Pedicure', description: 'x', price: 420, durationMinutes: 75, category: 'nails', active: true },
    { name: 'Custom Admin Service', description: 'x', price: 100, durationMinutes: 30, category: 'nails', active: true },
  ]);
  await syncCatalog(M);
  const mani = M.docs.filter((d) => d.name === 'Classic Manicure');
  assert.equal(mani.length, 1);
  assert.equal(mani[0].price, 999);
  assert.equal(mani[0].active, false);
  assert.equal(mani[0].slug, 'classic-manicure');
  assert.equal(mani[0].category, 'nail-services');
  assert.equal(M.docs.find((d) => d.name === 'Luxury Spa Pedicure').category, 'hand-foot-spa');
  assert.equal(M.docs.find((d) => d.name === 'Custom Admin Service').category, 'nail-services');
  assert.ok(M.docs.every((d) => CATEGORY_IDS.includes(d.category)));
  const before = M.docs.length;
  await syncCatalog(M);
  assert.equal(M.docs.length, before);
});

const appt = (over = {}) => ({
  reference: 'LN-ABCD1234', customerName: 'Jane', serviceName: 'Hot Stone Massage', serviceCategory: 'massage',
  servicePrice: 900, isStartingPrice: false, durationMinutes: 90, date: '2026-11-02', startMinutes: 14 * 60,
  technicianName: 'Ana', status: 'pending', ...over,
});

test('booking email contains all required details and says pending', () => {
  const { text, html, subject } = buildBookingEmail(appt());
  for (const needle of ['Jane', 'LN-ABCD1234', 'Massage Therapy', 'Hot Stone Massage', '2026-11-02', '2:00 PM', '1 h 30 min', '900', 'spa treatment', '(046) 123-4567', 'not a confirmed appointment']) {
    assert.ok(text.includes(needle), `text missing ${needle}`);
  }
  assert.ok(html.includes('Hot Stone Massage'));
  assert.match(subject, /request received/i);
});

test('email works for nail bookings, legacy bookings and confirmed status', () => {
  assert.ok(buildBookingEmail(appt({ serviceCategory: undefined, serviceName: 'Classic Manicure' })).text.includes('Nail Services'));
  const confirmed = buildBookingEmail(appt({ status: 'confirmed' }));
  assert.ok(!confirmed.text.includes('not a confirmed'));
  assert.ok(buildBookingEmail(appt({ isStartingPrice: true })).text.includes('From'));
});
