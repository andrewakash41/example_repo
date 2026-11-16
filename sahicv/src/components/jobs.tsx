import { useEffect, useState } from 'react';
import type { Job, JobStatus } from '../../shared/types.ts';
import { useActiveJob, useApp } from '../store.ts';
import { Button, Field, Input, TextArea } from './ui.tsx';

export const STATUS_LABEL: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Closed',
};

export function jobLabel(j: Job): string {
  const parts = [j.role, j.company].filter((x) => x.trim());
  return parts.length ? parts.join(' – ') : 'Untitled job';
}

/** Makes sure job-related pages always have a job to work on. */
export function useJob(): Job {
  const job = useActiveJob();
  const jobs = useApp((s) => s.jobs);
  useEffect(() => {
    if (job) return;
    // Several components use this hook at once, so read the live state:
    // the first one to run creates or selects the job, the rest do nothing.
    const s = useApp.getState();
    if (s.jobs.some((j) => j.id === s.activeJobId)) return;
    if (s.jobs.length) s.setActiveJob(s.jobs[0].id);
    else s.addJob();
  }, [job, jobs]);
  return job ?? { id: '', company: '', role: '', jd: '', url: '', status: 'saved', notes: '', createdAt: 0 };
}

/** Job picker plus the role, company and job-description fields shared by the AI pages. */
export function JobBar({ collapsible = false }: { collapsible?: boolean }) {
  const job = useJob();
  const jobs = useApp((s) => s.jobs);
  const { updateJob, addJob, setActiveJob } = useApp.getState();
  const [open, setOpen] = useState(!collapsible || job.jd.trim().length < 40);
  const set = (patch: Partial<Job>) => job.id && updateJob(job.id, patch);

  return (
    <div className="card pad jobbar">
      <div className="row row-between">
        <div className="row grow">
          <select className="input select" value={job.id} onChange={(e) => setActiveJob(e.target.value)} aria-label="Choose job">
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {jobLabel(j)}
              </option>
            ))}
          </select>
          <Button size="sm" icon="plus" onClick={() => { addJob(); setOpen(true); }}>
            New job
          </Button>
        </div>
        {collapsible ? (
          <button className="link-btn" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide job details' : 'Edit job details'}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="grid2 jobbar-fields">
          <Field label="Job title">
            <Input value={job.role} onChange={(v) => set({ role: v })} placeholder="Data Analyst" />
          </Field>
          <Field label="Company">
            <Input value={job.company} onChange={(v) => set({ company: v })} placeholder="Company name" />
          </Field>
          <Field label="Job description" wide hint="Paste the full text from the job post. It stays in your browser until you use an AI feature.">
            <TextArea value={job.jd} onChange={(v) => set({ jd: v })} minRows={5} placeholder="Paste the job description here…" style={{ maxHeight: 260 }} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
