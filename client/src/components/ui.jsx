import { Link } from 'react-router-dom';
import { Calendar, ChevronDown, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { formatDuration, formatPrice, resolveImageUrl } from '../lib/api';
import { getCategory } from '../config/categories';

export function PageHero({ title, subtitle }) {
  return (
    <section className="bg-brand-hero px-4 py-14 text-center text-white sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-3 max-w-xl text-sm text-white/90 sm:text-base">{subtitle}</p>}
    </section>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-ink-soft">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div role="alert" className="mx-auto my-10 max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
      <p>{message}</p>
      {onRetry && <button type="button" className="btn btn-outline mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function CtaBanner({ title, text, label = 'Book Your Appointment' }) {
  return (
    <section className="bg-brand-hero px-4 py-14 text-center text-white">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/90">{text}</p>
      <Link to="/booking" className="btn btn-white mt-6"><Calendar className="h-4 w-4" aria-hidden="true" /> {label}</Link>
    </section>
  );
}

export function ServiceCard({ service }) {
  const cat = getCategory(service.category);
  const fallback = cat.image;
  return (
    <article className="card flex flex-col overflow-hidden">
      <img
        src={resolveImageUrl(service.image) || fallback}
        alt={`${service.name} illustration`}
        loading="lazy"
        onError={(e) => { if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback; }}
        className="aspect-[16/9] w-full bg-brand-50 object-cover"
      />
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-xs font-medium text-brand-600">{cat.label}</p>
        <h3 className="font-semibold">{service.name}</h3>
        <p className="mt-1 flex-1 text-sm text-ink-soft">{service.description}</p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="font-semibold text-brand-600">{formatPrice(service.price, service.isStartingPrice)}</p>
            <p className="flex items-center gap-1 text-xs text-ink-mute"><Clock className="h-3 w-3" aria-hidden="true" /> {formatDuration(service.durationMinutes)}</p>
          </div>
          <Link to={`/booking?service=${service._id}`} className="btn btn-primary !px-5 !py-1.5" aria-label={`Book ${service.name}`}>Book Now</Link>
        </div>
      </div>
    </article>
  );
}

export function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-brand-100 overflow-hidden rounded-2xl bg-white shadow-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button type="button" id={`faq-btn-${i}`} aria-expanded={isOpen} aria-controls={`faq-panel-${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold hover:bg-brand-50 sm:text-base">
                {item.q}
                <ChevronDown className={`h-5 w-5 shrink-0 text-brand-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} hidden={!isOpen} className="px-5 pb-5 text-sm text-ink-soft">{item.a}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Field({ label, error, required, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}{required && <span className="text-brand-600"> *</span>}</label>
      {children}
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
