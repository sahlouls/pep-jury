// Barre de navigation : liens de routes Enrichir / Monitoring + bascule de langue.
import { Link, useRouterState } from '@tanstack/react-router';

import { useI18n } from '../lib/i18n';
import { LangToggle } from './lang-toggle';

const ACTIVE = 'rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700';
const INACTIVE = 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100';

export function NavBar() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: '/enrich', label: t('nav.enrich') },
    { to: '/analysis', label: t('nav.analysis') },
    { to: '/drift', label: t('nav.drift') },
  ] as const;
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-indigo-600">PEP</span>
          <span className="hidden text-sm text-slate-400 sm:inline">{t('app.fullname')}</span>
        </span>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <Link key={tab.to} to={tab.to} className={pathname === tab.to ? ACTIVE : INACTIVE}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <LangToggle />
    </header>
  );
}
