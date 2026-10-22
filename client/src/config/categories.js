// Service categories (must match server/src/utils/categories.js).
export const categories = [
  {
    id: "nail-services",
    label: "Nail Services",
    group: "nail",
    image: "/images/service-manicure.svg",
  },
  {
    id: "massage",
    label: "Massage Therapy",
    group: "spa",
    image: "/images/cat-massage-1.svg",
  },
  {
    id: "facial",
    label: "Facial Treatments",
    group: "spa",
    image: "/images/cat-facial-1.svg",
  },
  {
    id: "body",
    label: "Body Treatments",
    group: "spa",
    image: "/images/cat-body-1.svg",
  },
  {
    id: "waxing",
    label: "Waxing",
    group: "spa",
    image: "/images/cat-waxing-1.svg",
  },
  {
    id: "hand-foot-spa",
    label: "Hand and Foot Spa",
    group: "spa",
    image: "/images/cat-hand-foot-spa-1.svg",
  },
];

export const categoryIds = categories.map((c) => c.id);
// Legacy/missing categories (e.g. the old "nails") are treated as nail services.
export const normalizeCategory = (v) =>
  categoryIds.includes(v) ? v : "nail-services";
export const getCategory = (id) =>
  categories.find((c) => c.id === normalizeCategory(id));
export const categoryLabel = (id) => getCategory(id).label;
