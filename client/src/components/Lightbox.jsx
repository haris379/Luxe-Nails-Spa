import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function Lightbox({ items, index, onClose, onChange }) {
  const closeRef = useRef(null);
  const item = items[index];

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [index, items.length, onChange, onClose]);

  if (!item) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button ref={closeRef} type="button" aria-label="Close image viewer" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/90 p-2"><X className="h-5 w-5" /></button>
      <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); onChange((index - 1 + items.length) % items.length); }} className="absolute left-3 rounded-full bg-white/90 p-2"><ChevronLeft className="h-6 w-6" /></button>
      <figure className="max-h-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <img src={item.src} alt={item.alt} className="max-h-[80vh] w-full rounded-xl object-contain" />
        <figcaption className="mt-2 text-center text-sm text-white">{item.alt} · {item.category} · {index + 1}/{items.length}</figcaption>
      </figure>
      <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); onChange((index + 1) % items.length); }} className="absolute right-3 rounded-full bg-white/90 p-2"><ChevronRight className="h-6 w-6" /></button>
    </div>
  );
}
