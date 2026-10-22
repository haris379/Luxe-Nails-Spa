import { Link } from "react-router-dom";
import { Heart, ShieldCheck, Sparkles, Users } from "lucide-react";
import Seo from "../components/Seo";
import { CtaBanner, PageHero } from "../components/ui";
import { site } from "../config/site";

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

      <section className="bg-brand-50 py-14">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Our mission</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              To deliver beautiful, long-lasting nail services in a clean,
              comfortable setting, with clear prices and honest advice.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Hygiene and safety</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>Tools are cleaned and sanitised between guests</li>
              <li>
                Single-use files and buffers are discarded after each service
              </li>
              <li>Work surfaces are wiped down before every appointment</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-14" aria-labelledby="why-about">
        <div className="container-page">
          <h2 id="why-about" className="section-title">
            Why choose us
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, text }) => (
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
          <p className="section-sub">
            Sample team members — replace with the salon's real technicians.
          </p>
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

      <CtaBanner
        title="Ready to Pamper Yourself?"
        text="Book your appointment today and experience the care you deserve."
      />
    </>
  );
}
