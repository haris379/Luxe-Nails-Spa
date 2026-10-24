import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { navLinks } from "../config/site";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const linkClass = ({ isActive }) =>
    `rounded-md px-2 py-1 text-sm transition ${isActive ? "font-semibold text-brand-500" : "text-ink-soft hover:text-brand-500"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-white/30 shadow-sm backdrop-blur-md">
      {" "}
      <div className="container-page flex h-16 items-center justify-between sm:h-20">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="rounded-lg p-2 text-ink md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="border-t border-slate-100 bg-white md:hidden"
        >
          <div className="container-page flex flex-col gap-1 py-3">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-base ${isActive ? "bg-brand-50 font-semibold text-brand-600" : "text-ink"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
