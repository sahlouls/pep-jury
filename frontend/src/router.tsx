// Routeur TanStack (code-based, type-safe) : /enrich, /drift, /analysis ; / redirige vers /enrich.
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';

import { NavBar } from './components/nav-bar';
import { AnalysisPage } from './pages/analysis-page';
import { DriftPage } from './pages/drift-page';
import { EnrichPage } from './pages/enrich-page';

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <NavBar />
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/enrich' });
  },
});

const enrichRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/enrich',
  component: EnrichPage,
});

const driftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drift',
  component: DriftPage,
});

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analysis',
  component: AnalysisPage,
});

const routeTree = rootRoute.addChildren([indexRoute, enrichRoute, driftRoute, analysisRoute]);

export const router = createRouter({ routeTree });

// Enregistrement du type du routeur -> Link/navigate type-safes (necessite `interface`).
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
