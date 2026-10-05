import { useEffect, useState } from 'react';
import { Check, ChevronRight, Copy, Filter, Loader2, Network, TriangleAlert, UtilityPole, X } from 'lucide-react';
import { cx, fmtDate, fmtFixed, fmtInt, fmtKwValue, fmtPct, fmtPowerText, fmtSourceDate, tenure } from '../../lib/format';
import { useSqlQuery } from '../data/hooks';
import type { Detail } from '../data/types';
import { branchColor } from '../meta';
import { useLookups } from '../lookups';

interface Props {
  id: number;
  onClose: () => void;
  onSelect: (id: number) => void;
  onFilterTransformer: (code: string) => void;
  onFilterFeeder: (feederId: number) => void;
}

export function DetailDrawer({ id, onClose, onSelect, onFilterTransformer, onFilterFeeder }: Props) {
  const L = useLookups();
  const q = useSqlQuery<Detail>({ type: 'detail', rowId: id }, String(id));
  const d = q.data && q.data.row.id === id ? q.data : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const r = d?.row;
  const branch = r ? L.branch.get(r.branchId) : undefined;
  const csc = r ? L.csc.get(r.cscId) : undefined;
  const pss = r ? L.pss.get(r.pssId) : undefined;
  const feeder = r ? L.feeder.get(r.feederId) : undefined;
  const over = r ? r.inverter > r.capacity : false;
  const share = d && d.transformer.kw ? d.row.capacity / d.transformer.kw : 0;

  const copy = () => {
    if (!r) return;
    navigator.clipboard?.writeText(r.account).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Account detail">
        <header className="drawer-head">
          <div className="drawer-top">
            <div>
              <div className="drawer-kicker">Net plus account</div>
              <div className="drawer-acct mono">
                {r?.account ?? '··········'}
                {r && (
                  <button className="copy-btn" onClick={copy} aria-label="Copy account number" title="Copy">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close detail">
              <X size={17} />
            </button>
          </div>
          {r && (
            <nav className="crumbs" aria-label="Network path">
              <i className="chip-dot" style={{ background: branchColor(r.branchId) }} />
              <b>{branch?.name}</b>
              <ChevronRight size={12} className="sep" />
              {csc?.name}
              <ChevronRight size={12} className="sep" />
              <span className="mono">{pss?.name}</span>
              <ChevronRight size={12} className="sep" />
              <span className="mono">{feeder?.name}</span>
              <ChevronRight size={12} className="sep" />
              <b className="mono">{r.transformer}</b>
              <ChevronRight size={12} className="sep" />
              <b className="mono">{r.pole}</b>
            </nav>
          )}
        </header>

        <div className="drawer-body">
          {!d ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 40, color: 'var(--ink-3)' }}>
              <Loader2 size={20} className="spin" />
            </div>
          ) : (
            <>
              <section>
                <div className="dsec-title">System</div>
                <div className="dstats">
                  <div className="dstat">
                    <span>Array · CAPACITY</span>
                    <b className="num">
                      {fmtKwValue(d.row.capacity)}
                      <small>kW</small>
                    </b>
                  </div>
                  <div className="dstat">
                    <span>Inverter · INV_CAPACITY</span>
                    <b className="num">
                      {fmtKwValue(d.row.inverter)}
                      <small>kW</small>
                    </b>
                  </div>
                  <div className={cx('dstat', over && 'is-warn')}>
                    <span>DC/AC ratio</span>
                    <b className="num">{fmtFixed(d.row.capacity / d.row.inverter, 2)}</b>
                    {over && (
                      <em>
                        <TriangleAlert size={12} /> Inverter rated above array
                      </em>
                    )}
                  </div>
                  <div className="dstat">
                    <span>Connected</span>
                    <b>{fmtDate(d.row.date)}</b>
                    <em className="mono">{fmtSourceDate(d.row.date)}</em>
                    <em>Net plus for {tenure(d.row.date)}</em>
                  </div>
                </div>
              </section>

              <section>
                <div className="dsec-title">
                  Transformer
                  <span className="mono" style={{ color: 'var(--ink-2)', letterSpacing: 0 }}>
                    {d.row.transformer}
                  </span>
                </div>
                <div className="tf-card">
                  <div className="tf-line" style={{ marginTop: 0 }}>
                    Net plus accounts on transformer <b className="num">{fmtInt(d.transformer.count)}</b>
                  </div>
                  <div className="tf-line">
                    Connected array capacity <b className="num">{fmtPowerText(d.transformer.kw)}</b>
                  </div>
                  <div className="tf-line">
                    This account's rank by capacity{' '}
                    <b className="num">
                      #{d.transformer.rank} of {d.transformer.count}
                    </b>
                  </div>
                  <div className="share-bar" role="img" aria-label={`This account is ${fmtPct(share)} of the transformer's net plus capacity`}>
                    <span style={{ width: `${share * 100}%`, background: 'var(--agg)' }} />
                    <span style={{ flex: 1, background: 'transparent' }} />
                  </div>
                  <div className="tf-line">
                    Share of transformer capacity <b className="num">{fmtPct(share)}</b>
                  </div>
                </div>
              </section>

              <section>
                <div className="dsec-title">
                  <span>
                    Same pole · <span className="mono">{d.row.pole}</span>
                  </span>
                  <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{d.pole.length} account{d.pole.length === 1 ? '' : 's'}</span>
                </div>
                <div className="pole-list">
                  {d.pole.map((p) => (
                    <button key={p.id} className={cx('pole-item', p.id === d.row.id && 'is-self')} onClick={() => onSelect(p.id)}>
                      <span className="mono">
                        <UtilityPole size={12} style={{ verticalAlign: -1, marginRight: 8, color: 'var(--ink-3)' }} />
                        {p.account}
                      </span>
                      <span className="num">{fmtKwValue(p.capacity)} kW</span>
                      <span className="muted num">{fmtDate(p.date)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="drawer-actions">
                <button className="btn is-primary" onClick={() => onFilterTransformer(d.row.transformer)}>
                  <Filter size={14} /> All on {d.row.transformer}
                </button>
                <button className="btn" onClick={() => onFilterFeeder(d.row.feederId)}>
                  <Network size={14} /> Filter feeder {feeder?.name}
                </button>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
