import { Link } from "react-router-dom";
import Logo from "./Logo";
import { navLinks, site } from "../config/site";

export default function Footer() {
  return (
    <footer className="border-t border-brand-100 bg-white">
      <div className="container-page grid grid-cols-2 gap-6 py-10 sm:grid-cols-3 sm:gap-8">
        {/* Logo centered on the first mobile row */}
        <div className="col-span-2 flex flex-col items-center text-center sm:col-span-1 sm:items-start sm:text-left">
          <Logo small />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">{site.tagline}</p>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">Quick Links</h2>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            {navLinks.map((l) => (
              <li key={l.to}>
                <Link className="hover:text-brand-500" to={l.to}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">Contact</h2>
          <address className="space-y-1.5 text-sm not-italic text-ink-soft">
            {site.addressLines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p>
              <a className="hover:text-brand-500" href={site.phoneHref}>
                {site.phone}
              </a>
            </p>
            <p>
              <a className="hover:text-brand-500" href={`mailto:${site.email}`}>
                {site.email}
              </a>
            </p>
          </address>
        </div>
      </div>

      <div className="container-page border-t border-slate-100 py-5 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} Luxe Nails. All rights reserved.
      </div>
    </footer>
  );
}
