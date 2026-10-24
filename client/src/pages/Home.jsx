import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Award,
} from "lucide-react";
import Seo from "../components/Seo";
import { CtaBanner } from "../components/ui";
import { site, whatsappLink } from "../config/site";
import { galleryItems } from "../config/gallery";
import { categories } from "../config/categories";

const highlights = [
  {
    icon: Sparkles,
    title: "Premium Products",
    text: "We use only the finest, professional-grade products for lasting results.",
  },
  {
    icon: Award,
    title: "Expert Artists",
    text: "Our technicians focus on precision, nail health and creative design.",
  },
  {
    icon: ShieldCheck,
    title: "Hygienic Care",
    text: "Tools are cleaned and sanitised between every guest.",
  },
  {
    icon: Clock,
    title: "Convenient Hours",
    text: "Open 7 days a week with flexible scheduling to fit your busy lifestyle.",
  },
];

const nailGroup = [
  { label: "Manicure and pedicure", image: "/images/service-manicure.svg" },
  {
    label: "Gel nails and extensions",
    image: "/images/service-extensions.svg",
  },
  { label: "Nail art", image: "/images/service-art.svg" },
  { label: "Nail care treatments", image: "/images/service-repair.svg" },
];

// Sample offers: edit to match real promotions.
const offers = [
  {
    title: "Mani + Pedi Combo",
    text: "Pair a Classic Manicure with a Luxury Spa Pedicure in one visit.",
    note: "Sample offer",
  },
  {
    title: "Gel + Nail Art",
    text: "Add custom art to your gel manicure and make it one-of-a-kind.",
    note: "Sample offer",
  },
  {
    title: "Bring a Friend",
    text: "Book two appointments at the same time and enjoy pampering together.",
    note: "Sample offer",
  },
];

// Sample testimonials: replace with real, permissioned customer reviews.
const testimonials = [
  {
    name: "Sample Guest",
    text: "Replace this placeholder with a real review from a happy customer.",
  },
  {
    name: "Sample Guest",
    text: "Real testimonials build trust. Add the salon's genuine feedback here.",
  },
  {
    name: "Sample Guest",
    text: "Placeholder review text — ask clients for permission before publishing.",
  },
];

export default function Home() {
  return (
    <>
      <Seo
        title="Premium Nail Care & Artistry"
        description="Luxe Nails offers nail care and spa treatments (massage, facials, body treatments, waxing, hand and foot spa) in Rosario, Cavite. Book online."
      />
      {/* Hero Section  */}
      <section className="relative isolate overflow-hidden bg-[#3b1030] text-white">
        <img
          src="/images/HeroImage.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="container-page py-24 sm:py-32 lg:py-40">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Elevate Your Style with{" "}
            <span className="text-brand-300">Luxe Nails</span>
          </h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg">
            Experience premium nail care, spa treatments and artistry. Where
            elegance meets creativity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/booking"
              className="btn btn-primary !px-8 !py-3.5 text-base"
            >
              <Calendar className="h-5 w-5" aria-hidden="true" /> Book Now
            </Link>
            <Link
              to="/services"
              className="btn btn-white !px-8 !py-3.5 text-base"
            >
              Explore Our Services
            </Link>
          </div>
        </div>
      </section>
      {/* Nail & Spa Section  */}
      <section className="bg-brand-50 py-14" aria-labelledby="featured-title">
        <div className="container-page">
          <h2 id="featured-title" className="section-title">
            Nail Care and Spa & Wellness
          </h2>
          <p className="section-sub">
            One salon for polished nails and full relaxation. Choose a treatment
            and book online.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Nail Care */}
            <article
              className="card flex h-full flex-col overflow-hidden"
              aria-labelledby="nail-care-title"
            >
              <img
                src="/images/nailCare.jpg"
                alt="Illustration of manicured nails"
                loading="lazy"
                className="aspect-[16/7] w-full object-cover"
              />

              <div className="flex flex-1 flex-col p-5">
                <h3 id="nail-care-title" className="text-xl font-bold">
                  Nail Care
                </h3>

                <p className="mt-1 text-sm text-ink-soft">
                  Manicures, pedicures, gel and acrylic extensions, nail art and
                  repairs.
                </p>

                <ul className="mt-4 grid grid-cols-2 gap-3">
                  {nailGroup.map((n) => (
                    <li key={n.label}>
                      <Link
                        to="/services?category=nail-services"
                        className="block rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm font-medium transition hover:bg-brand-100"
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-wrap gap-3 pt-5">
                  <Link
                    to="/services?category=nail-services"
                    className="btn btn-primary"
                  >
                    Explore Nail Services
                  </Link>

                  <Link to="/booking" className="btn btn-outline">
                    Book an Appointment
                  </Link>
                </div>
              </div>
            </article>

            {/* Spa and Wellness */}
            <article
              className="card flex h-full flex-col overflow-hidden"
              aria-labelledby="spa-title"
            >
              <img
                src="/images/SpaAndWellness.jpg"
                alt="Illustration of a relaxing spa treatment"
                loading="lazy"
                className="aspect-[16/7] w-full object-cover"
              />

              <div className="flex flex-1 flex-col p-5">
                <h3 id="spa-title" className="text-xl font-bold">
                  Spa and Wellness
                </h3>

                <p className="mt-1 text-sm text-ink-soft">
                  Massage therapy, facials, body treatments, waxing and hand and
                  foot spa.
                </p>

                <ul className="mt-4 grid grid-cols-2 gap-3">
                  {categories
                    .filter((c) => c.group === "spa")
                    .map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/services?category=${c.id}`}
                          className="block rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm font-medium transition hover:bg-brand-100"
                        >
                          {c.label}
                        </Link>
                      </li>
                    ))}
                </ul>

                <div className="mt-auto flex flex-wrap gap-3 pt-5">
                  <Link
                    to="/services?category=massage"
                    className="btn btn-primary"
                  >
                    Explore Spa Services
                  </Link>

                  <Link to="/booking" className="btn btn-outline">
                    Book an Appointment
                  </Link>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-8 text-center">
            <Link to="/services" className="btn btn-outline">
              View All Services
            </Link>
          </div>
        </div>
      </section>
      {/* Latest work Section  */}
      <section className="py-14" aria-labelledby="latest-title">
        <div className="container-page">
          <h2 id="latest-title" className="section-title">
            Our Latest Work
          </h2>
          <p className="section-sub">
            Get inspired by our collection of stunning nail designs.
            (Demonstration images.)
          </p>

          <div className="mt-8 grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
            {galleryItems.slice(0, 4).map((g) => (
              <Link
                key={g.id}
                to="/gallery"
                className="block overflow-hidden rounded-xl bg-brand-50"
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-brand-50 p-2">
                  <img
                    src={g.src}
                    alt={g.alt}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link to="/gallery" className="btn btn-outline">
              View Full Gallery
            </Link>
          </div>
        </div>
      </section>
     
      {/* Saloon Section  */}
      <section className="bg-brand-50 py-14" aria-labelledby="about-title">
        <div className="container-page grid items-center gap-8 md:grid-cols-2">
          <img
            src="/images/SaloonImage.jpg"
            alt="Illustration of manicured nails"
            loading="lazy"
            className="mx-auto aspect-[9/10] w-full max-w-sm rounded-2xl object-cover"
          />
          <div>
            <h2 id="about-title" className="text-2xl font-bold sm:text-3xl">
              A salon built around care and creativity
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              Luxe Nails is a neighbourhood nail and spa studio in Rosario,
              Cavite. We focus on healthy nails, careful hygiene and designs
              that suit you.
            </p>
            <Link to="/about" className="btn btn-primary mt-5">
              About Us
            </Link>
          </div>
        </div>
      </section>
      {/* Special Offers Section  */}
      <section className="py-14" aria-labelledby="offers-title">
        <div className="container-page">
          <h2 id="offers-title" className="section-title">
            Special Offers & Packages
          </h2>
          <p className="section-sub">
            Sample packages — the salon can update these with real promotions.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {offers.map((o) => (
              <div key={o.title} className="card border border-brand-100 p-5">
                <p className="text-xs font-medium text-brand-600">{o.note}</p>
                <h3 className="mt-1 font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{o.text}</p>
                <Link
                  to="/booking"
                  className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
                >
                  Book this
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* What guest says Section  */}
      <section className="bg-brand-50 py-14" aria-labelledby="reviews-title">
        <div className="container-page">
          <h2 id="reviews-title" className="section-title">
            What Guests Say
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <figure key={i} className="card p-5">
                <blockquote className="text-sm text-ink-soft">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-3 text-sm font-semibold">
                  {t.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      {/* Location Section  */}
     
      <CtaBanner
        title="Ready to Pamper Yourself?"
        text="Book your appointment today and experience the luxury you deserve."
      />
    </>
  );
}
