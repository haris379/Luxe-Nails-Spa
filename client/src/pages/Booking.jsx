import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Calendar, Clock, User } from 'lucide-react';
import Seo from '../components/Seo';
import { ErrorBox, Field, PageHero, Spinner } from '../components/ui';
import { api, formatDuration, formatPrice, parseError } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { site, whatsappLink } from '../config/site';
import EmailVerification from '../components/EmailVerification';
import { categories, normalizeCategory, getCategory } from '../config/categories';

const todayIn = (tz, offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

function validate(f) {
  const e = {};
  if (f.customerName.trim().length < 2) e.customerName = 'Enter your full name';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address';
  else if (!f.verificationToken) e.email = 'Verify your email address to continue';
  if (!PHONE_RE.test(f.phone.trim()) || f.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
  if (!f.category) e.category = 'Choose a service category';
  if (!f.serviceId) e.serviceId = 'Choose a service';
  if (!f.date) e.date = 'Choose a date';
  if (!f.time) e.time = 'Choose an available time';
  if (f.notes.length > 500) e.notes = 'Notes must be 500 characters or fewer';
  return e;
}

const errClass = (e) => (e ? 'input input-error' : 'input');

export default function Booking() {
  const [params] = useSearchParams();
  const { data: services, loading, error, reload } = useFetch('/services');
  const { data: biz } = useFetch('/business');
  const tz = biz?.timezone || 'Asia/Manila';
  const minDate = todayIn(tz);
  const maxDate = todayIn(tz, biz?.maxAdvanceDays || 90);

  const [form, setForm] = useState({ customerName: '', email: '', phone: '', verificationToken: '', category: categories.some((c) => c.id === params.get('category')) ? params.get('category') : '', serviceId: params.get('service') || '', date: '', time: '', technicianId: 'any', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [avail, setAvail] = useState({ loading: false, slots: [], closed: false, error: '' });
  const submitLock = useRef(false);
  const [verifyReset, setVerifyReset] = useState(0); // bumps to make the verification UI start over
  const setToken = (token) => setForm((f) => (f.verificationToken === token ? f : { ...f, verificationToken: token }));

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value, ...(name !== 'time' && name !== 'category' && name !== 'customerName' && name !== 'email' && name !== 'phone' && name !== 'notes' ? { time: '' } : {}) }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  // Choosing a category clears the service and time.
  const onCategory = (e) => {
    setForm((f) => ({ ...f, category: e.target.value, serviceId: '', time: '' }));
    setErrors((er) => ({ ...er, category: undefined, serviceId: undefined }));
  };

  // A service preselected from a "Book Now" button also selects its category.
  useEffect(() => {
    if (!services || !form.serviceId) return;
    const found = services.find((s) => s._id === form.serviceId);
    if (found) setForm((f) => (f.category === normalizeCategory(found.category) ? f : { ...f, category: normalizeCategory(found.category) }));
  }, [services, form.serviceId]);

  // Drop a preselected service that no longer exists.
  useEffect(() => {
    if (services && form.serviceId && !services.some((s) => s._id === form.serviceId)) setForm((f) => ({ ...f, serviceId: '' }));
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  const service = useMemo(() => services?.find((s) => s._id === form.serviceId), [services, form.serviceId]);
  const categoryServices = useMemo(() => (services || []).filter((s) => normalizeCategory(s.category) === form.category), [services, form.category]);

  const loadSlots = () => {
    if (!form.serviceId || !form.date) return () => {};
    const controller = new AbortController();
    setAvail({ loading: true, slots: [], closed: false, error: '' });
    api.get('/appointments/availability', { params: { serviceId: form.serviceId, date: form.date, technicianId: form.technicianId }, signal: controller.signal })
      .then((res) => setAvail({ loading: false, slots: res.data.data.slots, closed: res.data.data.closed, error: '' }))
      .catch((err) => { if (err.code !== 'ERR_CANCELED') setAvail({ loading: false, slots: [], closed: false, error: parseError(err).message }); });
    return () => controller.abort();
  };
  useEffect(() => {
    const cancel = loadSlots();
    return typeof cancel === 'function' ? cancel : undefined;
  }, [form.serviceId, form.date, form.technicianId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e) {
    e.preventDefault();
    if (submitLock.current) return;
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    submitLock.current = true;
    setSubmitting(true);
    try {
      const res = await api.post('/appointments', { ...form, customerName: form.customerName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes: form.notes.trim(), verificationToken: form.verificationToken });
      setConfirmation(res.data.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const p = parseError(err);
      setFormError(p.message);
      setErrors((er) => ({ ...er, ...p.fieldErrors }));
      const c = err.response?.data?.code;
      if (c === 'EMAIL_NOT_VERIFIED' || c === 'VERIFICATION_EXPIRED') setVerifyReset((n) => n + 1);
      if (p.status === 409) { setForm((f) => ({ ...f, time: '' })); loadSlots(); }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <>
        <Seo title="Booking received" />
        <PageHero title="Booking Received" subtitle="Your request has been saved by the salon." />
        <section className="container-page max-w-lg py-12">
          <div className="card p-6 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-500" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-bold">Thank you, {form.customerName.split(' ')[0]}!</h2>
            <p className="mt-1 text-sm text-ink-soft">Reference <strong className="text-ink">{confirmation.reference}</strong> · Status: {confirmation.status} (awaiting salon confirmation)</p>
            <dl className="mt-5 space-y-2 rounded-xl bg-brand-50 p-4 text-left text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Category</dt><dd>{confirmation.categoryLabel}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Service</dt><dd>{confirmation.serviceName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Date</dt><dd>{confirmation.date}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Time</dt><dd>{confirmation.timeLabel}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Duration</dt><dd>{formatDuration(confirmation.durationMinutes)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Price</dt><dd>{formatPrice(confirmation.servicePrice, confirmation.isStartingPrice)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Technician</dt><dd>{confirmation.technicianName}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-ink-soft">
              {confirmation.emailStatus === 'sent' && `Your email address is verified. We emailed the booking details to ${form.email}. The salon will confirm your appointment shortly.`}
              {confirmation.emailStatus === 'not_configured' && 'Please keep this reference. The salon will confirm your appointment directly.'}
              {confirmation.emailStatus === 'failed' && 'Your booking is saved, but we could not send the email just now. Please keep this reference. The salon can resend it.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className="btn btn-outline">Back to Home</Link>
              <a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={whatsappLink(`Hi Luxe Nails, my booking reference is ${confirmation.reference}.`)}>Message on WhatsApp</a>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo title="Book an Appointment" description="Book a nail or spa appointment online. Choose a category, service, date and an available time." />
      <PageHero title="Book Your Appointment" subtitle="Schedule your visit and let us pamper you with our premium services." />
      <section className="container-page max-w-2xl py-10">
        {loading && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {services?.length === 0 && <ErrorBox message="Online booking is unavailable because no services are listed yet. Please contact the salon." />}
        {services?.length > 0 && (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}

            <fieldset className="rounded-2xl bg-brand-50 p-5">
              <legend className="mb-3 flex items-center gap-2 px-1 text-base font-semibold"><User className="h-4 w-4 text-brand-500" aria-hidden="true" /> Personal Information</legend>
              <div className="space-y-4">
                <Field label="Full Name" required error={errors.customerName} htmlFor="customerName">
                  <input id="customerName" className={errClass(errors.customerName)} autoComplete="name" placeholder="Enter your full name" value={form.customerName} onChange={set('customerName')} aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? 'customerName-error' : undefined} />
                </Field>
                <EmailVerification value={form.email} onValueChange={(v) => { setForm((f) => ({ ...f, email: v })); setErrors((er) => ({ ...er, email: undefined })); }} error={errors.email} onTokenChange={setToken} resetKey={verifyReset} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone Number" required error={errors.phone} htmlFor="phone">
                    <input id="phone" type="tel" className={errClass(errors.phone)} autoComplete="tel" placeholder="0917 123 4567" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} />
                  </Field>
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl bg-brand-50 p-5">
              <legend className="mb-3 flex items-center gap-2 px-1 text-base font-semibold"><Calendar className="h-4 w-4 text-brand-500" aria-hidden="true" /> Appointment Details</legend>
              <div className="space-y-4">
                <Field label="Service Category" required error={errors.category} htmlFor="category">
                  <select id="category" className={errClass(errors.category)} value={form.category} onChange={onCategory}>
                    <option value="">Choose a category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Select Service" required error={errors.serviceId} htmlFor="serviceId">
                  <select id="serviceId" className={errClass(errors.serviceId)} value={form.serviceId} onChange={set('serviceId')} disabled={!form.category}>
                    <option value="">{form.category ? 'Choose a service' : 'Choose a category first'}</option>
                    {categoryServices.map((s) => <option key={s._id} value={s._id}>{s.name} — {formatPrice(s.price, s.isStartingPrice)} ({formatDuration(s.durationMinutes)})</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred Date" required error={errors.date} htmlFor="date">
                    <input id="date" type="date" className={errClass(errors.date)} min={minDate} max={maxDate} value={form.date} onChange={set('date')} />
                  </Field>
                  <Field label="Preferred Technician" htmlFor="technicianId">
                    <select id="technicianId" className="input" value={form.technicianId} onChange={set('technicianId')}>
                      <option value="any">No preference</option>
                      {biz?.technicians?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Field>
                </div>

                <div>
                  <p className="label"><Clock className="mr-1 inline h-4 w-4 text-brand-500" aria-hidden="true" />Available Time <span className="text-brand-600">*</span></p>
                  {!form.serviceId || !form.date ? (
                    <p className="text-sm text-ink-soft">Choose a service and date to see available times.</p>
                  ) : avail.loading ? (
                    <Spinner label="Checking availability…" />
                  ) : avail.error ? (
                    <ErrorBox message={avail.error} onRetry={loadSlots} />
                  ) : avail.closed ? (
                    <p className="text-sm text-ink-soft">No times are bookable on this date (the salon may be closed or the date has passed). Please pick another day.</p>
                  ) : (
                    <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {avail.slots.map((s) => (
                        <button key={s.time} type="button" role="radio" aria-checked={form.time === s.time} disabled={!s.available}
                          onClick={() => { setForm((f) => ({ ...f, time: s.time })); setErrors((er) => ({ ...er, time: undefined })); }}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${form.time === s.time ? 'border-transparent bg-brand-gradient text-white' : s.available ? 'border-slate-200 bg-white hover:border-brand-500' : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400 line-through'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.time && <p role="alert" className="mt-1 text-xs text-red-600">{errors.time}</p>}
                </div>

                <Field label="Additional Notes (optional)" error={errors.notes} htmlFor="notes">
                  <textarea id="notes" rows={3} maxLength={500} className={errClass(errors.notes)} placeholder="Design ideas, allergies to products, etc." value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
            </fieldset>

            {service && <p className="text-center text-sm text-ink-soft">{getCategory(service.category).label} · {service.name}: {formatPrice(service.price, service.isStartingPrice)} · about {formatDuration(service.durationMinutes)}. Pay at the salon; no payment is taken online.</p>}

            {!form.verificationToken && <p className="text-center text-xs text-ink-soft">Verify your email address above to enable booking.</p>}
            <button type="submit" disabled={submitting || !form.verificationToken} className="btn btn-primary w-full !py-3.5 text-base">
              {submitting ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Confirming…</> : <><Calendar className="h-5 w-5" aria-hidden="true" /> Confirm Booking</>}
            </button>

            <div className="rounded-2xl bg-brand-50 p-5 text-sm">
              <h2 className="mb-2 font-semibold">Booking Information</h2>
              <ul className="space-y-1.5 text-ink-soft">
                <li>Please arrive 10 minutes early for your appointment.</li>
                <li>Cancellations must be made 24 hours in advance.</li>
                <li>We accept cash, credit cards, and digital payments at the salon.</li>
                <li>Your appointment is saved as pending until the salon confirms it.</li>
              </ul>
              <p className="mt-3 text-xs text-ink-soft">Prefer to talk? Call <a className="underline" href={site.phoneHref}>{site.phone}</a> or <a className="underline" target="_blank" rel="noopener noreferrer" href={whatsappLink()}>WhatsApp us</a>.</p>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
