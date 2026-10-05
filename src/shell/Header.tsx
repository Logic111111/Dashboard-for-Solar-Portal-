import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, User } from 'lucide-react';
import { LogoMark } from './LogoMark';
import type { Theme } from './useTheme';

const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Colombo',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return clockFmt.format(now).replace(',', '').replace(/, (\d)/, ' · $1');
}

export function Header({ theme, onToggleTheme, onMenu }: { theme: Theme; onToggleTheme: () => void; onMenu: () => void }) {
  const clock = useClock();
  return (
    <header className="topbar">
      <div className="brand">
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <LogoMark className="brand-mark" />
        <div>
          <div className="brand-title">Renewable Energy Desk</div>
          <div className="brand-sub">Lanka Electricity Company (Pvt) Ltd</div>
        </div>
      </div>
      <div className="topbar-right">
        <span className="clock num">{clock} IST</span>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <div className="user-chip">
          <User size={16} />
          <span>solaradmin</span>
        </div>
      </div>
    </header>
  );
}
