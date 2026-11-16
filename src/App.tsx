import { useEffect, useRef } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state';
import { dateLabel, num } from './lib/format';
import Upload from './pages/Upload';
import Overview from './pages/Overview';
import Flags from './pages/Flags';
import People from './pages/People';
import Payees from './pages/Payees';
import Bars from './pages/Bars';
import Loans from './pages/Loans';
import SettingsPage from './pages/Settings';

const TABS = [
  { to: '/overview', label: 'Overview' },
  { to: '/flags', label: 'Red flags & drains' },
  { to: '/people', label: 'People' },
  { to: '/payees', label: 'Paybills & tills' },
  { to: '/bars', label: 'Bars & restaurants' },
  { to: '/loans', label: 'Fuliza & loans' },
  { to: '/settings', label: 'Settings' },
];

function TabBar() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    // Keep the active tab visible when the bar is scrolled on narrow screens.
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <nav ref={ref} aria-label="Sections" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto px-3 sm:px-6">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm ${isActive ? 'border-gray-900 font-medium text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { analysis } = useApp();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const loaded = !!analysis;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 pb-1 pt-3 sm:px-6">
          <Link to={loaded ? '/overview' : '/'} className="text-base font-semibold tracking-tight">
            M-PESA money flow
          </Link>
          {analysis && (
            <div className="flex items-baseline gap-3 text-xs text-gray-500">
              <span className="tabular-nums">
                {dateLabel(analysis.summary.first)} – {dateLabel(analysis.summary.last)} · {num(analysis.summary.transactions)} transactions
              </span>
              <Link to="/" className="whitespace-nowrap text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900">
                New file
              </Link>
            </div>
          )}
        </div>
        {loaded && (
          <div className="mx-auto max-w-6xl">
            <TabBar />
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <Routes>
          <Route path="/" element={<Upload />} />
          {loaded ? (
            <>
              <Route path="/overview" element={<Overview />} />
              <Route path="/flags" element={<Flags />} />
              <Route path="/people" element={<People />} />
              <Route path="/payees" element={<Payees />} />
              <Route path="/bars" element={<Bars />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Routes>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-gray-400 sm:px-6">
        Processed on this device only — nothing is uploaded.
      </footer>
    </div>
  );
}
