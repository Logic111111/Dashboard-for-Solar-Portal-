import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../../lib/format';

interface Props {
  icon: ReactNode;
  label: string;
  value?: string | null;
  active?: boolean;
  align?: 'left' | 'right';
  width?: number;
  children: (close: () => void) => ReactNode;
}

export function Popover({ icon, label, value, active, align = 'left', width, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="pop-wrap" ref={ref}>
      <button
        className={cx('fbtn', active && 'is-active', open && 'is-open')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {icon}
        {label}
        {value && <span className="fbtn-val">{value}</span>}
        <ChevronDown size={14} className="chev" />
      </button>
      {open && (
        <div className={cx('pop', align === 'right' && 'is-right')} role="dialog" aria-label={label} style={width ? { width } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
