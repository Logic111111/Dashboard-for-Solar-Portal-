import { useCallback, useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { Header } from './shell/Header';
import { ModuleTabs, type ModuleDef } from './shell/ModuleTabs';
import { useTheme } from './shell/useTheme';
import { useBoot } from './netplus/data/hooks';
import { BootScreen } from './netplus/components/BootScreen';
import { NetPlusModule } from './netplus/NetPlusModule';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const boot = useBoot();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((m: ModuleDef) => setToast(`“${m.label}” opens in the main Renewable Energy Desk`), []);

  return (
    <div className="app">
      <Header theme={theme} onToggleTheme={toggleTheme} onMenu={() => setSidebarOpen(true)} />
      <ModuleTabs active="netplus" onNavigate={onNavigate} />
      {boot.result && (
        <NetPlusModule init={boot.result} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} notify={setToast} />
      )}
      <BootScreen state={boot} />
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
