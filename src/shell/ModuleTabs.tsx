import { Settings, Sun, TrendingUp, UsersRound, Zap, type LucideIcon } from 'lucide-react';
import { cx } from '../lib/format';

export interface ModuleDef {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
  isNew?: boolean;
}

/** The desk's existing modules, plus this one. Only `netplus` is implemented in this app. */
export const MODULES: ModuleDef[] = [
  { id: 'history', label: 'Net Generation History', short: 'History', icon: Zap },
  { id: 'estimation', label: 'Pure Generation Estimation', short: 'Estimation', icon: Sun },
  { id: 'forecast', label: 'Pure Generation Forecasting', short: 'Forecasting', icon: TrendingUp },
  { id: 'control', label: 'Generation Control', short: 'Control', icon: Settings },
  { id: 'netplus', label: 'Net Plus Customers', short: 'Net Plus', icon: UsersRound, isNew: true },
];

export function ModuleTabs({ active, onNavigate }: { active: string; onNavigate: (m: ModuleDef) => void }) {
  return (
    <nav className="modtabs" aria-label="Desk modules">
      {MODULES.map((m) => {
        const Icon = m.icon;
        const isActive = m.id === active;
        return (
          <button
            key={m.id}
            className={cx('modtab', isActive && 'is-active')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => !isActive && onNavigate(m)}
          >
            <Icon size={17} />
            <span>{m.label}</span>
            {m.isNew && <span className="modtab-new">NEW</span>}
          </button>
        );
      })}
    </nav>
  );
}
