import { useMemo, useState } from "react";
import Seo from "../components/Seo";
import Lightbox from "../components/Lightbox";
import { CtaBanner, PageHero } from "../components/ui";
import { galleryCategories, galleryItems } from "../config/gallery";

export default function Gallery() {
  const [category, setCategory] = useState("All Designs");
  const [active, setActive] = useState(null);
  const items = useMemo(
    () =>
      category === "All Designs"
        ? galleryItems
        : galleryItems.filter((i) => i.category === category),
    [category],
  );

  return (
    <>
      <Seo
        title="Nail Art Gallery"
        description="Browse nail art, gel, acrylic and chrome designs for inspiration."
      />
      <PageHero
        title="Our Gallery"
        subtitle="Browse our collection of stunning nail designs for inspiration."
      />
      <div className="bg-brand-50 py-5">
        <div
          className="container-page flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Filter designs by category"
        >
          {galleryCategories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${category === c ? "bg-brand-gradient text-white" : "bg-white text-ink hover:text-brand-600"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <section className="container-page py-10">
        <p className="mb-4 text-center text-xs text-ink-mute">
          Demonstration illustrations, not actual salon work.
        </p>
        {items.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">
            No designs in this category yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`View larger: ${item.alt}`}
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-brand-50 p-2"
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {active !== null && (
        <Lightbox
          items={items}
          index={active}
          onClose={() => setActive(null)}
          onChange={setActive}
        />
      )}
      <CtaBanner
        title="Love What You See?"
        text="Book your appointment and let our artists bring your vision to life."
      />
    </>
  );
}
