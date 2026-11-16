import { lazy, Suspense, useEffect } from 'react';
import { loadConfig } from './api.ts';
import { Paywall } from './components/pass.tsx';
import { Toasts } from './components/ui.tsx';
import Landing from './pages/Landing.tsx';
import { Contact, Privacy, Refunds, Terms } from './pages/Legal.tsx';
import { usePath } from './router.tsx';

const Workspace = lazy(() => import('./pages/Workspace.tsx'));

export default function App() {
  const path = usePath();
  useEffect(() => {
    void loadConfig();
  }, []);

  let page;
  if (path.startsWith('/app')) {
    page = (
      <Suspense
        fallback={
          <div className="page-skeleton">
            <span className="spinner" /> Loading…
          </div>
        }
      >
        <Workspace path={path} />
      </Suspense>
    );
  } else if (path === '/privacy') page = <Privacy />;
  else if (path === '/terms') page = <Terms />;
  else if (path === '/refunds') page = <Refunds />;
  else if (path === '/contact') page = <Contact />;
  else page = <Landing />;

  return (
    <>
      {page}
      <Paywall />
      <Toasts />
    </>
  );
}
