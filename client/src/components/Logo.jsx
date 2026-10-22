import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function Logo({ small, plain }) {
  const Wrapper = plain ? 'span' : Link;
  const wrapperProps = plain ? { className: 'inline-flex items-center gap-2.5' } : { to: '/', className: 'inline-flex items-center gap-2.5', 'aria-label': 'Luxe Nails home' };
  return (
    <Wrapper {...wrapperProps}>
      <span className={`flex items-center justify-center rounded-xl bg-brand-gradient text-white ${small ? 'h-7 w-7' : 'h-10 w-10'}`}>
        <Sparkles className={small ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden="true" />
      </span>
      <span className={`font-semibold text-brand-500 ${small ? 'text-base' : 'text-2xl'}`}>Luxe Nails</span>
    </Wrapper>
  );
}
