// Single source of truth for service categories (server side).
export const CATEGORIES = [
  { id: 'nail-services', label: 'Nail Services', group: 'nail' },
  { id: 'massage', label: 'Massage Therapy', group: 'spa' },
  { id: 'facial', label: 'Facial Treatments', group: 'spa' },
  { id: 'body', label: 'Body Treatments', group: 'spa' },
  { id: 'waxing', label: 'Waxing', group: 'spa' },
  { id: 'hand-foot-spa', label: 'Hand and Foot Spa', group: 'spa' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Legacy / missing / unknown values (e.g. the old default "nails") count as nail services. */
export const normalizeCategory = (value) => (CATEGORY_IDS.includes(value) ? value : 'nail-services');
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === normalizeCategory(id)).label;
export const categoryGroup = (id) => CATEGORIES.find((c) => c.id === normalizeCategory(id)).group;
export const categoryOrder = (id) => CATEGORY_IDS.indexOf(normalizeCategory(id));
