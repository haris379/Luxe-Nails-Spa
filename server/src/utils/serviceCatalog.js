// Demo service catalogue (prices in PHP, durations in minutes). Sample values only:
// the salon can change everything from the admin dashboard after seeding.
import { CATEGORY_IDS } from './categories.js';

export const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const img = (key, i) => `/images/cat-${key}-${(i % 3) + 1}.svg`;

// [name, description, price, minutes, startingPrice?]
const spa = (category, key, rows) =>
  rows.map(([name, description, price, durationMinutes, isStartingPrice], i) => ({
    name, description, price, durationMinutes, isStartingPrice: Boolean(isStartingPrice), category, image: img(key, i),
  }));

const nail = [
  ['Classic Manicure', 'Traditional nail care with shaping, cuticle care, hand massage, and polish application.', 350, 45, false, '/images/service-manicure.svg'],
  ['Gel Polish Manicure', 'Long-lasting gel polish that stays chip-free for up to 3 weeks with brilliant shine.', 450, 60, false, '/images/service-gel.svg'],
  ['Acrylic Full Set', 'Durable acrylic extensions for length and strength, customized to your preferred shape.', 480, 90, false, '/images/service-acrylic.svg'],
  ['Custom Nail Art', 'Express your creativity with hand-painted designs, crystals, and unique embellishments.', 500, 75, true, '/images/service-art.svg'],
  ['Chrome & Metallic Nails', 'Mirror-like chrome or metallic finish for a futuristic, eye-catching look.', 490, 90, false, '/images/service-chrome.svg'],
  ['Gel Extensions', 'Natural-looking length and strength with flexible, lightweight gel extensions.', 500, 120, false, '/images/service-extensions.svg'],
  ['Nail Repair & Maintenance', 'Fix broken nails and maintain your existing set for perfect nails all the time.', 300, 30, true, '/images/service-repair.svg'],
  ['Polish Change', 'Quick color change with your choice of regular or gel polish.', 320, 30, false, '/images/service-polish.svg'],
].map(([name, description, price, durationMinutes, isStartingPrice, image]) => ({
  name, description, price, durationMinutes, isStartingPrice, image, category: 'nail-services',
}));

const handFootSpa = [
  // Existing seeded service: reused (not duplicated) as the salon's spa pedicure.
  { name: 'Luxury Spa Pedicure', description: 'Complete foot care with exfoliation, massage, paraffin treatment, and polish.', price: 420, durationMinutes: 75, isStartingPrice: false, category: 'hand-foot-spa', image: '/images/service-pedicure.svg' },
  ...spa('hand-foot-spa', 'hand-foot-spa', [
    ['Luxury Manicure', 'A pampering manicure with warm soak, gentle scrub, cuticle care, massage and polish.', 450, 60],
    ['Foot Soak and Scrub', 'A warm aromatic soak followed by an exfoliating scrub to leave feet soft and refreshed.', 350, 30],
    ['Hand Spa Treatment', 'Exfoliation, a hydrating mask and a relaxing hand massage for soft, smooth hands.', 400, 45],
    ['Paraffin Hand Treatment', 'Warm paraffin wax to deeply moisturize and soften dry hands.', 300, 30],
    ['Paraffin Foot Treatment', 'Warm paraffin wax to soothe and moisturize tired, dry feet.', 350, 30],
  ]),
];

export const catalog = [
  ...nail,
  ...handFootSpa,
  ...spa('massage', 'massage', [
    ['Relaxation Massage', 'Gentle, flowing strokes to melt away stress and leave you calm.', 600, 60],
    ['Swedish Massage', 'Classic long strokes and kneading to ease tension and improve circulation.', 650, 60],
    ['Deep Tissue Massage', 'Firm pressure that targets tight muscles and knots.', 750, 60],
    ['Aromatherapy Massage', 'A soothing massage with essential oils chosen to suit your mood.', 700, 60],
    ['Hot Stone Massage', 'Smooth warmed stones and massage to deeply relax muscles.', 900, 90],
    ['Back, Neck and Shoulder Massage', 'A focused massage for the areas that hold the most tension.', 400, 30],
  ]),
  ...spa('facial', 'facial', [
    ['Classic Facial', 'Cleansing, exfoliation, massage and a mask for fresh, balanced skin.', 500, 60],
    ['Deep Cleansing Facial', 'A thorough cleanse with steam and gentle extraction to clear congested pores.', 650, 75],
    ['Hydrating Facial', 'A moisture-rich treatment for dry or dull-looking skin.', 600, 60],
    ['Brightening Facial', 'Targets uneven tone and dullness for a brighter, more radiant look.', 700, 60],
    ['Anti-Aging Facial', 'A firming, nourishing treatment to help smooth the look of fine lines.', 850, 75],
    ['Express Facial', 'A quick cleanse, mask and moisturize when you are short on time.', 300, 30],
  ]),
  ...spa('body', 'body', [
    ['Body Scrub', 'A full-body scrub that sweeps away dead skin and leaves it smooth.', 650, 45],
    ['Body Polish', 'A polishing treatment that exfoliates and adds a soft, healthy glow.', 750, 60],
    ['Body Wrap', 'A nourishing wrap that relaxes the body and leaves skin soft.', 900, 75],
    ['Exfoliating Body Treatment', 'Deep exfoliation followed by a light moisturizer for renewed skin.', 800, 60],
    ['Hydrating Body Treatment', 'An intensely moisturizing treatment for dry or tight skin.', 800, 60],
  ]),
  ...spa('waxing', 'waxing', [
    ['Full Arms Waxing', 'Smooth hair removal from shoulder to wrist.', 400, 30],
    ['Half Arms Waxing', 'Smooth hair removal for the forearms or upper arms.', 250, 30],
    ['Full Legs Waxing', 'Smooth hair removal from thigh to ankle.', 600, 45],
    ['Half Legs Waxing', 'Smooth hair removal for the lower or upper legs.', 350, 30],
    ['Underarms Waxing', 'A quick, tidy underarm wax.', 150, 15],
    ['Facial Waxing', 'Gentle waxing for brows, upper lip or chin. Price is per area.', 200, 30, true],
    ['Full Body Waxing', 'Complete head-to-toe waxing. Final price depends on the areas chosen.', 2200, 120, true],
  ]),
].map((s, i) => ({ ...s, slug: slugify(s.name), sortOrder: i }));

export function validateCatalog(list = catalog) {
  const slugs = new Set();
  const errors = [];
  for (const s of list) {
    if (slugs.has(s.slug)) errors.push(`duplicate slug ${s.slug}`);
    slugs.add(s.slug);
    if (!CATEGORY_IDS.includes(s.category)) errors.push(`${s.name}: bad category`);
    if (!(s.price >= 0) || !(s.durationMinutes >= 15)) errors.push(`${s.name}: bad price/duration`);
  }
  return errors;
}

/**
 * Safe, repeatable catalogue sync. Works with any model exposing find/create/updateOne.
 * - Inserts services that do not exist yet (matched by slug, or by name for legacy docs without a slug).
 * - Never overwrites price, duration, description, image or active flag of existing services,
 *   so admin edits survive re-running the seed.
 * - Fills in a missing slug and migrates legacy categories (e.g. "nails") to valid ones.
 */
export async function syncCatalog(Service, list = catalog) {
  const existing = await Service.find().lean();
  const bySlug = new Map(existing.filter((d) => d.slug).map((d) => [d.slug, d]));
  const legacyByName = new Map(existing.filter((d) => !d.slug).map((d) => [d.name, d]));
  const handled = new Set();
  const result = { created: 0, updated: 0, unchanged: 0 };

  for (const def of list) {
    const doc = bySlug.get(def.slug) || legacyByName.get(def.name);
    if (!doc) {
      await Service.create({ ...def, active: true });
      result.created += 1;
      continue;
    }
    handled.add(String(doc._id));
    const patch = {};
    if (!doc.slug) patch.slug = def.slug;
    if (!CATEGORY_IDS.includes(doc.category)) patch.category = def.category;
    if (Object.keys(patch).length) {
      await Service.updateOne({ _id: doc._id }, { $set: patch });
      result.updated += 1;
    } else result.unchanged += 1;
  }

  // Admin-created legacy services outside the catalogue: just fix an invalid category.
  for (const doc of existing) {
    if (!handled.has(String(doc._id)) && !CATEGORY_IDS.includes(doc.category) && !bySlug.has(doc.slug)) {
      await Service.updateOne({ _id: doc._id }, { $set: { category: 'nail-services' } });
      result.updated += 1;
    }
  }
  return result;
}
