import { Link } from "react-router-dom";
import {
  Heart,
  ShieldCheck,
  Sparkles,
  Users,
  Award,
  Clock,
} from "lucide-react";
import Seo from "../components/Seo";
import { CtaBanner, PageHero, Accordion } from "../components/ui";
import { site, faqs } from "../config/site";

const values = [
  {
    icon: Sparkles,
    title: "Quality products",
    text: "Professional-grade polish, gel and acrylic systems chosen for finish and nail health.",
  },
  {
    icon: ShieldCheck,
    title: "Hygiene first",
    text: "Metal tools are cleaned and sanitised between guests, and single-use items are never reused.",
  },
  {
    icon: Heart,
    title: "Personal care",
    text: "Every service starts with a conversation about the shape, length and look you want.",
  },
  {
    icon: Users,
    title: "Welcoming space",
    text: "A relaxed salon where guests can unwind, whether it's a quick polish change or a full set.",
  },
];

const team = [
  { name: "Ana", role: "Nail technician" },
  { name: "Bea", role: "Nail technician" },
  { name: "Carla", role: "Nail technician" },
];

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

export default function About() {
  return (
    <>
      <Seo
        title="About Us"
        description="Learn about Luxe Nails, our approach to nail care, hygiene practices and the team behind the salon in Rosario, Cavite."
      />
      <PageHero
        title="About Luxe Nails"
        subtitle="Premium nail care and artistry for the modern woman."
      />

      <section className="container-page grid items-center gap-10 py-14 md:grid-cols-2">
        <img
          src="/images/about.jpg"
          alt="Illustration of manicured nails"
          className="mx-auto aspect-[9/10] w-full max-w-sm rounded-2xl object-cover"
        />
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Our story</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Luxe Nails is a nail and spa studio in {site.addressLines[0]},{" "}
            {site.addressLines[1]}. We started with a simple idea: a manicure
            should leave your nails healthier and your day a little brighter.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            From a quick polish change to custom nail art and extensions, our
            technicians take the time to listen, recommend what suits your nails
            and lifestyle, and finish every set with care.
          </p>
          <p className="mt-3 text-xs text-ink-mute">
            Sample copy — the salon should replace this with its real story.
          </p>
        </div>
      </section>

      {/* Wjy choose Section  */}
      <section className="py-14" aria-labelledby="why-title">
        <div className="container-page">
          <h2 id="why-title" className="section-title">
            Why Choose Luxe Nails?
          </h2>
          <p className="section-sub">
            We combine luxury, expertise, and creativity to deliver exceptional
            nail care services.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl bg-brand-50 p-5 text-center"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-50 py-14">
        <div className="container-page">
          <h2 className="section-title">Meet the team</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {team.map((t) => (
              <li key={t.name} className="card p-5 text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-2xl font-semibold text-white"
                >
                  {t.name[0]}
                </span>
                <p className="mt-3 font-semibold">{t.name}</p>
                <p className="text-xs text-ink-soft">{t.role}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-ink-soft">
            Questions before you visit?{" "}
            <Link
              to="/contact"
              className="font-semibold text-brand-600 underline"
            >
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-14" aria-labelledby="faq-title">
        <div className="container-page max-w-3xl">
          <h2 id="faq-title" className="section-title">
            Frequently Asked Questions
          </h2>
          <div className="mt-8">
            <Accordion items={faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Ready to Pamper Yourself?"
        text="Book your appointment today and experience the care you deserve."
      />
    </>
  );
}
