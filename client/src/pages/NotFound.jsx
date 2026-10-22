import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFound() {
  return (
    <section className="container-page py-24 text-center">
      <Seo title="Page not found" />
      <p className="text-6xl font-bold text-brand-500">404</p>
      <h1 className="mt-3 text-2xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-sm text-ink-soft">The link may be broken or the page may have moved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn btn-primary">Back to Home</Link>
        <Link to="/services" className="btn btn-outline">View Services</Link>
      </div>
    </section>
  );
}
