import { Link, useSearchParams } from 'react-router-dom';
import Seo from '../components/Seo';
import { CtaBanner, ErrorBox, PageHero, ServiceCard, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { categories, categoryIds, normalizeCategory } from '../config/categories';

// Sample add-ons shown as upgrades (prices in PHP).
const addons = [
  { name: 'Crystals & Gems', price: '₱50 - ₱100' },
  { name: 'Ombre Design', price: '₱50' },
  { name: 'Hand Massage', price: '₱70' },
  { name: 'Paraffin Wax', price: '₱90' },
];

export default function Services() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('category');
  const active = categoryIds.includes(requested) ? requested : 'all';
  const { data: services, loading, error, reload } = useFetch('/services');

  const choose = (id) => setParams(id === 'all' ? {} : { category: id }, { replace: true });
  const visible = services?.filter((s) => active === 'all' || normalizeCategory(s.category) === active) || [];
  const tabs = [{ id: 'all', label: 'All Services' }, ...categories];

  return (
    <>
      <Seo title="Nail & Spa Services and Prices" description="Nail services, massage, facials, body treatments, waxing and hand and foot spa, with prices and durations." />
      <PageHero title="Our Services" subtitle="Nail care and spa treatments with transparent prices and estimated durations. Prices shown are samples." />

      <div className="bg-brand-50 py-5">
        <div className="container-page flex flex-wrap justify-center gap-2" role="group" aria-label="Filter services by category">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={active === t.id} onClick={() => choose(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition sm:text-sm ${active === t.id ? 'bg-brand-gradient text-white' : 'bg-white text-ink hover:text-brand-600'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <section className="container-page py-12">
        {loading && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {services?.length === 0 && <p className="py-10 text-center text-ink-soft">No services are listed yet. Please check back soon or <Link className="text-brand-600 underline" to="/contact">contact us</Link>.</p>}
        {services?.length > 0 && visible.length === 0 && <p className="py-10 text-center text-ink-soft">No services in this category yet. Try another category.</p>}

        {visible.length > 0 && active !== 'all' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((s) => <ServiceCard key={s._id} service={s} />)}</div>
        )}

        {visible.length > 0 && active === 'all' && categories.map((c) => {
          const list = visible.filter((s) => normalizeCategory(s.category) === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="mb-12 last:mb-0" aria-labelledby={`cat-${c.id}`} role="region">
              <h2 id={`cat-${c.id}`} className="mb-5 text-xl font-bold">{c.label}</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((s) => <ServiceCard key={s._id} service={s} />)}</div>
            </div>
          );
        })}
      </section>

      {(active === 'all' || active === 'nail-services') && (
        <section className="bg-brand-50 py-12">
          <div className="container-page">
            <h2 className="section-title">Enhance Your Experience</h2>
            <p className="section-sub">Upgrade your service with these luxurious add-ons. Ask for them when you arrive.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {addons.map((a) => (
                <li key={a.name} className="card p-4 text-center"><p className="text-sm font-medium">{a.name}</p><p className="mt-1 text-sm font-semibold text-brand-600">{a.price}</p></li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaBanner title="Ready to Book Your Service?" text="Choose your perfect nail or spa service and schedule your appointment today." />
    </>
  );
}
