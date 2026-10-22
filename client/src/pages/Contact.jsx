import { useRef, useState } from 'react';
import { Clock, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { Facebook, Instagram, Twitter } from '../components/SocialIcons';
import Seo from '../components/Seo';
import { Accordion, Field, PageHero } from '../components/ui';
import { api, parseError } from '../lib/api';
import { faqs, site, whatsappLink } from '../config/site';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const empty = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', text: '' });
  const [sending, setSending] = useState(false);
  const lock = useRef(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  async function onSubmit(e) {
    e.preventDefault();
    if (lock.current) return;
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Enter your name';
    if (!EMAIL_RE.test(form.email.trim())) found.email = 'Enter a valid email address';
    if (form.subject.trim().length < 3) found.subject = 'Enter a subject';
    if (form.message.trim().length < 10) found.message = 'Message must be at least 10 characters';
    setErrors(found);
    setStatus({ type: '', text: '' });
    if (Object.keys(found).length) return;

    lock.current = true;
    setSending(true);
    try {
      const res = await api.post('/contact', { name: form.name.trim(), email: form.email.trim(), subject: form.subject.trim(), message: form.message.trim() });
      setStatus({ type: 'success', text: res.data.message });
      setForm(empty);
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      setStatus({ type: 'error', text: p.message });
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  const info = [
    { icon: MapPin, title: 'Our Location', body: site.addressLines.join(', ') },
    { icon: Phone, title: 'Phone Number', body: <a href={site.phoneHref}>{site.phone}</a> },
    { icon: Mail, title: 'Email Address', body: <a href={`mailto:${site.email}`}>{site.email}</a> },
  ];

  return (
    <>
      <Seo title="Contact Us" description="Contact Luxe Nails in Rosario, Cavite by form, phone, WhatsApp or email. See opening hours and directions." />
      <PageHero title="Contact Us" subtitle="Have questions? We'd love to hear from you. Send a message and we'll respond as soon as possible." />

      <section className="container-page grid gap-8 py-12 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">Get In Touch</h2>
          <p className="mt-2 text-sm text-ink-soft">We're here to answer any questions you may have about our services. (Sample contact details.)</p>
          <ul className="mt-5 space-y-3">
            {info.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 rounded-xl bg-brand-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <div><p className="text-sm font-semibold">{title}</p><p className="text-sm text-ink-soft">{body}</p></div>
              </li>
            ))}
            <li className="flex gap-4 rounded-xl bg-brand-50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white"><Clock className="h-5 w-5" aria-hidden="true" /></span>
              <div className="flex-1 text-sm"><p className="font-semibold">Business Hours</p>
                {site.hours.map(([d, h]) => <p key={d} className="text-ink-soft">{d}: {h}</p>)}
              </div>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp Us</a>
            <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline"><MapPin className="h-4 w-4" aria-hidden="true" /> Get Directions</a>
          </div>
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Follow Us</p>
            <div className="flex gap-3">
              {[['Facebook', Facebook, site.social.facebook], ['Instagram', Instagram, site.social.instagram], ['Twitter', Twitter, site.social.twitter]].map(([label, Icon, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Luxe Nails on ${label}`} className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-ink hover:text-brand-600"><Icon /></a>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl bg-brand-50 p-6" aria-label="Contact form">
          <h2 className="text-lg font-bold">Send Us a Message</h2>
          {status.text && <div role={status.type === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{status.text}</div>}
          <Field label="Your Name" required error={errors.name} htmlFor="c-name"><input id="c-name" className={errors.name ? 'input input-error' : 'input'} autoComplete="name" placeholder="Enter your name" value={form.name} onChange={set('name')} /></Field>
          <Field label="Email Address" required error={errors.email} htmlFor="c-email"><input id="c-email" type="email" className={errors.email ? 'input input-error' : 'input'} autoComplete="email" placeholder="your@email.com" value={form.email} onChange={set('email')} /></Field>
          <Field label="Subject" required error={errors.subject} htmlFor="c-subject"><input id="c-subject" className={errors.subject ? 'input input-error' : 'input'} placeholder="How can we help?" value={form.subject} onChange={set('subject')} /></Field>
          <Field label="Message" required error={errors.message} htmlFor="c-message"><textarea id="c-message" rows={5} maxLength={2000} className={errors.message ? 'input input-error' : 'input'} placeholder="Tell us more about your inquiry…" value={form.message} onChange={set('message')} /></Field>
          <button type="submit" disabled={sending} className="btn btn-primary w-full !py-3">
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…</> : <><Send className="h-4 w-4" aria-hidden="true" /> Send Message</>}
          </button>
        </form>
      </section>

      <section className="bg-brand-50 py-12">
        <div className="container-page">
          <h2 className="section-title">Visit Our Salon</h2>
          <p className="section-sub">Located in {site.addressLines[0]}, {site.addressLines[1]}.</p>
          <div className="mt-6 overflow-hidden rounded-2xl shadow-card">
            <iframe title="Map showing the salon area" src={site.mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full border-0 sm:h-96" />
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-3xl">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="mt-6"><Accordion items={faqs} /></div>
        </div>
      </section>
    </>
  );
}
