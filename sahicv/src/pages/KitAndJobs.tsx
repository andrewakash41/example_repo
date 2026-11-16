import { useState } from 'react';
import type { Job, JobStatus, KitResult } from '../../shared/types.ts';
import { runAi } from '../api.ts';
import { JobBar, STATUS_LABEL, jobLabel } from '../components/jobs.tsx';
import { AiNote } from '../components/pass.tsx';
import { Button, CopyButton, Empty, Field, Icon, IconButton, Input, TextArea } from '../components/ui.tsx';
import { navigate } from '../router.tsx';
import { useActiveJob, useActiveResume, useApp, useUi } from '../store.ts';

export function KitPage() {
  const resume = useActiveResume();
  const job = useActiveJob();
  const key = `kit:${resume.id}:${job?.id ?? ''}`;
  const kit = useUi((s) => s.cache[key]) as KitResult | undefined;
  const setCache = useUi((s) => s.setCache);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const res = await runAi<{ kit: KitResult }>('job-kit', { resume, jd: job?.jd ?? '', role: job?.role ?? '', company: job?.company ?? '' });
    setBusy(false);
    if (res?.kit) setCache(key, res.kit);
  };

  const options = (title: string, hint: string, items: string[]) => (
    <div className="card pad">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      <div className="stack-sm">
        {items.map((x, i) => (
          <div key={i} className="kit-option">
            <p>{x}</p>
            <CopyButton text={x} />
          </div>
        ))}
      </div>
    </div>
  );
  const block = (title: string, hint: string, text: string) => (
    <div className="card pad">
      <div className="row row-between">
        <h3>{title}</h3>
        <CopyButton text={text} />
      </div>
      <p className="muted small">{hint}</p>
      <p className="pre">{text}</p>
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Job-search kit</h1>
        <p>The other things recruiters read: your LinkedIn headline and About section, your Naukri resume headline, a referral request and a cold email. Written from your resume in one go.</p>
      </header>
      <JobBar collapsible />
      <div className="card pad ai-card">
        <div className="row row-between">
          <p className="muted">
            Uses <strong>{resume.label}</strong>
            {job && jobLabel(job) !== 'Untitled job' ? (
              <>
                {' '}
                and the job <strong>{jobLabel(job)}</strong>
              </>
            ) : (
              '. Add a job above to aim the messages at a specific company.'
            )}
          </p>
          <Button variant="ai" size="lg" icon="spark" busy={busy} onClick={generate} data-testid="kit-btn">
            {kit ? 'Write again' : 'Write my kit'}
          </Button>
        </div>
        <AiNote />
      </div>
      {!kit ? (
        <Empty icon="kit" title="Nothing written yet">
          One click writes all five pieces. It uses 1 AI action.
        </Empty>
      ) : (
        <div className="stack">
          {options('LinkedIn headline', 'Shown next to your name everywhere on LinkedIn. Pick one.', kit.linkedinHeadline)}
          {block('LinkedIn "About"', 'Paste into the About section of your profile.', kit.linkedinAbout)}
          {options('Naukri resume headline', 'Recruiters on Naukri search and scan this line first. Pick one.', kit.naukriHeadline)}
          {block('Referral request', 'Send on LinkedIn or WhatsApp to someone who works at the company. Replace [Name].', kit.referralMessage)}
          {block(`Cold email: ${kit.coldEmail.subject}`, 'Send to the recruiter or hiring manager with your resume attached.', kit.coldEmail.body)}
        </div>
      )}
    </div>
  );
}

const STATUSES: JobStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

function JobCard({ job }: { job: Job }) {
  const { updateJob, deleteJob, setActiveJob } = useApp.getState();
  const resumes = useApp((s) => s.resumes);
  const [open, setOpen] = useState(false);
  const go = (path: string) => {
    setActiveJob(job.id);
    navigate(path);
  };
  const linked = resumes.find((r) => r.id === job.resumeId);
  return (
    <div className={`card jobcard status-${job.status}`}>
      <div className="jobcard-main">
        <button className="jobcard-title" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <strong>{job.role || 'Untitled role'}</strong>
          <span>{job.company || 'Company not set'}</span>
        </button>
        <select className="input select status-select" value={job.status} onChange={(e) => updateJob(job.id, { status: e.target.value as JobStatus })} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="jobcard-meta">
        <span>Added {new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        {linked ? <span className="badge badge-ok">Tailored resume: {linked.label}</span> : null}
        {job.coverLetter ? <span className="badge">Cover letter</span> : null}
        {job.questions?.length ? <span className="badge">Interview prep</span> : null}
      </div>
      <div className="row jobcard-actions">
        <Button size="sm" icon="target" onClick={() => go('/app/tailor')}>
          Tailor
        </Button>
        <Button size="sm" icon="mail" onClick={() => go('/app/cover-letter')}>
          Cover letter
        </Button>
        <Button size="sm" icon="mic" onClick={() => go('/app/interview')}>
          Interview
        </Button>
        {job.url ? (
          <a className="btn btn-ghost btn-sm" href={/^https?:/.test(job.url) ? job.url : `https://${job.url}`} target="_blank" rel="noreferrer">
            <Icon name="link" size={15} />
            <span>Job post</span>
          </a>
        ) : null}
        <span className="grow" />
        <IconButton
          icon="trash"
          label="Delete job"
          onClick={() => {
            if (window.confirm(`Delete "${jobLabel(job)}" and its saved letter and prep?`)) deleteJob(job.id);
          }}
        />
      </div>
      {open ? (
        <div className="grid2 jobcard-edit">
          <Field label="Job title">
            <Input value={job.role} onChange={(v) => updateJob(job.id, { role: v })} />
          </Field>
          <Field label="Company">
            <Input value={job.company} onChange={(v) => updateJob(job.id, { company: v })} />
          </Field>
          <Field label="Link to the job post" wide>
            <Input value={job.url} onChange={(v) => updateJob(job.id, { url: v })} placeholder="https://…" inputMode="url" />
          </Field>
          <Field label="Notes" wide hint="Recruiter name, salary discussed, next step…">
            <TextArea value={job.notes} onChange={(v) => updateJob(job.id, { notes: v })} minRows={2} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

export function JobsPage() {
  const jobs = useApp((s) => s.jobs);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const shown = jobs.filter((j) => filter === 'all' || j.status === filter);
  const count = (s: JobStatus) => jobs.filter((j) => j.status === s).length;
  return (
    <div className="page">
      <header className="page-head">
        <h1>Application tracker</h1>
        <p>Every job you are going for in one place, with its tailored resume, cover letter and interview prep. Saved in this browser only.</p>
      </header>
      <div className="row row-between">
        <div className="seg seg-wrap" role="tablist" aria-label="Filter by status">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            All <small>{jobs.length}</small>
          </button>
          {STATUSES.map((s) => (
            <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]} <small>{count(s)}</small>
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            useApp.getState().addJob();
            navigate('/app/tailor');
          }}
        >
          Add a job
        </Button>
      </div>
      {!shown.length ? (
        <Empty icon="briefcase" title={jobs.length ? 'No jobs with this status' : 'No jobs yet'}>
          {jobs.length ? 'Choose another filter.' : 'Add a job to tailor your resume to it and track where you stand.'}
        </Empty>
      ) : (
        <div className="jobgrid">
          {shown.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
