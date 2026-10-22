// Simple inline brand glyphs (lucide-react no longer ships brand icons).
const base = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, className: 'h-5 w-5' };

export const Facebook = (p) => (
  <svg {...base} {...p}><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.7c0-.9.3-1.5 1.5-1.5h1.6V4.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.1H8v3h2.4V21h3.1z" /></svg>
);
export const Instagram = (p) => (
  <svg {...base} {...p} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>
);
export const Twitter = (p) => (
  <svg {...base} {...p}><path d="M18.2 3.5h2.9l-6.3 7.2 7.4 9.8h-5.8l-4.5-6-5.2 6H3.8l6.7-7.7L3.4 3.5h5.9l4.1 5.4 4.8-5.4zm-1 15.3h1.6L8.6 5.1H6.9l10.3 13.7z" /></svg>
);
