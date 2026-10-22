import { useEffect } from 'react';

export default function Seo({ title, description, noindex = false }) {
  useEffect(() => {
    document.title = title ? `${title} | Luxe Nails` : 'Luxe Nails | Premium Nail Care & Artistry';
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
  }, [title, description]);

  // Keep private pages out of search engines (the tag must live in <head>).
  useEffect(() => {
    if (!noindex) return undefined;
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [noindex]);
  return null;
}
