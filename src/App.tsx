import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state';
import { dateLabel, num } from './lib/format';
import Upload from './pages/Upload';
const Overview = lazy(() => import('./pages/Overview'));
const Flags = lazy(() => import('./pages/Flags'));
const People = lazy(() => import('./pages/People'));
const Payees = lazy(() => import('./pages/Payees'));
const Bars = lazy(() => import('./pages/Bars'));
const Loans = lazy(() => import('./pages/Loans'));
const SettingsPage = lazy(() => import('./pages/Settings'));

/**
 * Suspense fallback for lazy pages. Waits briefly before showing anything so fast loads
 * never flash; reserves height so the footer does not jump. Lives inside <main>, so the
 * sticky header and tab bar are never affected.
 */
function PageFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="min-h-[60vh] py-10 text-sm text-gray-500">
      {show ? 'Loading…' : null}
    </div>
  );
}

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
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // Announce navigation: update the title and move focus to the content (not on first load).
    const tab = TABS.find((t) => t.to === pathname);
    document.title = tab ? `${tab.label} · M-PESA Money Flow` : 'M-PESA Money Flow';
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
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
      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-6xl outline-none px-4 py-5 sm:px-6 sm:py-6">
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-gray-500 sm:px-6">
        Processed on this device only — nothing is uploaded.
      </footer>
    </div>
  );
}
