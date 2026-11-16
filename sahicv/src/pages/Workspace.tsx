import { lazy, Suspense } from 'react';
import { BRAND } from '../../shared/plans.ts';
import { PassButton } from '../components/pass.tsx';
import { Icon, Logo } from '../components/ui.tsx';
import { Link, navigate } from '../router.tsx';
import { useUi } from '../store.ts';

const ResumePage = lazy(() => import('./ResumePage.tsx'));
const TailorPage = lazy(() => import('./TailorPage.tsx'));
const CoverLetterPage = lazy(() => import('./CoverLetterPage.tsx'));
const InterviewPage = lazy(() => import('./InterviewPage.tsx'));
const KitPage = lazy(() => import('./KitAndJobs.tsx').then((m) => ({ default: m.KitPage })));
const JobsPage = lazy(() => import('./KitAndJobs.tsx').then((m) => ({ default: m.JobsPage })));

const NAV = [
  ['resume', 'Resume', 'file'],
  ['tailor', 'Tailor', 'target'],
  ['cover-letter', 'Cover letter', 'mail'],
  ['interview', 'Interview', 'mic'],
  ['kit', 'Job kit', 'kit'],
  ['jobs', 'Tracker', 'briefcase'],
] as const;

export default function Workspace({ path }: { path: string }) {
  const tab = path.split('/')[2] || 'resume';
  const demo = useUi((s) => s.config?.demo);
  if (!NAV.some(([id]) => id === tab)) {
    navigate('/app/resume', { replace: true });
    return null;
  }
  return (
    <div className="app">
      <header className="appbar">
        <Link href="/" className="appbar-logo" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <nav className="appnav" aria-label="Sections">
          {NAV.map(([id, label, icon]) => (
            <Link key={id} href={`/app/${id}`} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined}>
              <Icon name={icon} size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <PassButton />
      </header>
      {demo ? <div className="demo-banner">Demo mode: AI answers are placeholders and payments are simulated. Add an AI key and Razorpay keys to go live.</div> : null}
      <main className={`appmain appmain-${tab}`}>
        <Suspense
          fallback={
            <div className="page-skeleton">
              <span className="spinner" /> Loading…
            </div>
          }
        >
          {tab === 'resume' ? <ResumePage /> : null}
          {tab === 'tailor' ? <TailorPage /> : null}
          {tab === 'cover-letter' ? <CoverLetterPage /> : null}
          {tab === 'interview' ? <InterviewPage /> : null}
          {tab === 'kit' ? <KitPage /> : null}
          {tab === 'jobs' ? <JobsPage /> : null}
        </Suspense>
      </main>
    </div>
  );
}
