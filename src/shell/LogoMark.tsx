import { useId } from 'react';

/** Neutral placeholder mark (sun over a PV array) — swap for the official logo when integrating. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const sun = `${id}-sun`;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return { x1: 32 + Math.cos(a) * 12.5, y1: 26 + Math.sin(a) * 12.5, x2: 32 + Math.cos(a) * 16.5, y2: 26 + Math.sin(a) * 16.5 };
  });
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="16" fill="var(--panel)" stroke="var(--line-2)" />
      <g className="rays" stroke={`url(#${sun})`} strokeWidth="2.6" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} {...r} />
        ))}
      </g>
      <circle cx="32" cy="26" r="8" fill={`url(#${sun})`} />
      <path d="M13.5 53 L20 41 H44 L50.5 53 Z" fill="var(--accent-soft)" stroke="var(--ink-2)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 41 L24.5 53 M38 41 L39.5 53 M16.8 47 H47.2" stroke="var(--ink-2)" strokeWidth="1.6" />
    </svg>
  );
}
