import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { LogoMark } from '../../shell/LogoMark';
import { cx, fmtInt, fmtMs } from '../../lib/format';
import type { BootState } from '../data/hooks';

export function BootScreen({ state }: { state: BootState }) {
  const [gone, setGone] = useState(false);
  const done = state.status === 'ready';
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;

  const engine = state.result?.engine;
  const waiting = state.stage === 'waiting';
  const steps = [
    {
      label: 'Connect to the API server',
      status: done || waiting ? 'is-done' : 'is-active',
      meta: '',
    },
    {
      label: waiting ? 'Waiting for PostgreSQL' : 'Query PostgreSQL',
      status: done ? 'is-done' : waiting ? 'is-active' : '',
      meta: done ? `${engine?.engine} · ${fmtMs(state.ms)}` : waiting ? `attempt ${state.attempts}` : '',
    },
    {
      label: 'Load network hierarchy',
      status: done ? 'is-done' : '',
      meta: done ? `${fmtInt(engine?.rows ?? 0)} accounts` : '',
    },
  ];
  const pct = done ? 1 : waiting ? Math.min(0.85, 0.3 + state.attempts * 0.02) : 0.3;

  return (
    <div className={cx('boot', done && 'is-done')} aria-live="polite" aria-busy={!done}>
      <div className="boot-card">
        <LogoMark className="boot-mark" />
        <h1>Net Plus Customer Portal</h1>
        <p>Renewable Energy Desk · connecting to PostgreSQL</p>
        {state.status === 'error' ? (
          <div className="boot-error">
            <b>Could not load the portal.</b>
            <div style={{ marginTop: 6 }}>{state.error}</div>
            <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>
              Start everything with <code>npm run dev</code>. For your own database, set <code>DATABASE_URL</code> in <code>.env</code> and run{' '}
              <code>npm run db:seed</code>.
            </div>
          </div>
        ) : (
          <>
            <ol className="boot-steps">
              {steps.map((s) => (
                <li key={s.label} className={cx('boot-step', s.status)}>
                  <span className="boot-ico">{s.status === 'is-done' && <Check size={12} strokeWidth={3} />}</span>
                  <span>{s.label}</span>
                  <span className="meta num">{s.meta}</span>
                </li>
              ))}
            </ol>
            <div className="boot-bar">
              <span style={{ width: `${pct * 100}%` }} />
            </div>
            {waiting && state.message && (
              <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12.5 }}>{state.message} Retrying…</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
