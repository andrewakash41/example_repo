import { useMemo, useState } from 'react';
import type { Resume, TailorChange, TailorResult } from '../../shared/types.ts';
import { matchResume, scoreLabel } from '../analysis/match.ts';
import { runAi } from '../api.ts';
import { JobBar, jobLabel, useJob } from '../components/jobs.tsx';
import { AiNote } from '../components/pass.tsx';
import { Button, Chip, Empty, Icon, ScoreRing } from '../components/ui.tsx';
import { cloneResume, uid } from '../resume/model.ts';
import { resumeToText } from '../resume/text.ts';
import { navigate } from '../router.tsx';
import { useActiveResume, useApp, useUi } from '../store.ts';

type Change = TailorChange & { key: string; label: string };

function describe(r: Resume, c: TailorChange): string {
  if (c.target === 'summary') return 'Summary';
  if (c.target === 'skills') return `Skills: ${r.skills.find((g) => g.id === c.entryId)?.name || 'group'}`;
  if (c.target === 'experience') {
    const e = r.experience.find((x) => x.id === c.entryId);
    return e ? [e.title, e.company].filter(Boolean).join(', ') : 'Experience';
  }
  return `Project: ${r.projects.find((x) => x.id === c.entryId)?.name ?? ''}`;
}

function applyChanges(r: Resume, changes: Change[]) {
  for (const c of changes) {
    if (c.key === 'headline') r.basics.headline = c.after;
    else if (c.target === 'summary') r.basics.summary = c.after;
    else if (c.target === 'skills') {
      const g = r.skills.find((x) => x.id === c.entryId);
      if (g) g.items = c.after;
    } else if (c.target === 'experience') {
      const e = r.experience.find((x) => x.id === c.entryId);
      if (e && c.bulletIndex !== undefined && c.bulletIndex < e.bullets.length) e.bullets[c.bulletIndex] = c.after;
    } else {
      const p = r.projects.find((x) => x.id === c.entryId);
      if (p && c.bulletIndex !== undefined && c.bulletIndex < p.bullets.length) p.bullets[c.bulletIndex] = c.after;
    }
  }
}

export default function TailorPage() {
  const resume = useActiveResume();
  const job = useJob();
  const toast = useUi((s) => s.toast);
  const cacheKey = `tailor:${resume.id}:${job.id}`;
  const cached = useUi((s) => s.cache[cacheKey]) as { result: TailorResult; changes: Change[] } | undefined;
  const setCache = useUi((s) => s.setCache);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const jdReady = job.jd.trim().length >= 40;
  const match = useMemo(() => (jdReady ? matchResume(resumeToText(resume), job.jd, job.role) : null), [resume, job.jd, job.role, jdReady]);

  const tailor = async () => {
    setBusy(true);
    const result = await runAi<TailorResult>('tailor', { resume, jd: job.jd, role: job.role, company: job.company });
    setBusy(false);
    if (!result) return;
    const changes: Change[] = result.changes.map((c, i) => ({ ...c, key: `c${i}`, label: describe(resume, c) }));
    if (result.headline && result.headline !== resume.basics.headline) {
      changes.unshift({ key: 'headline', label: 'Headline', target: 'summary', before: resume.basics.headline, after: result.headline, reason: 'Matches the title of the job you are applying for.' });
    }
    setCache(cacheKey, { result, changes });
    setPicked(Object.fromEntries(changes.map((c) => [c.key, !c.warning])));
    if (!changes.length) toast('Your resume already fits this job well. No rewrites suggested.');
  };

  const chosen = (cached?.changes ?? []).filter((c) => picked[c.key] ?? !c.warning);

  const apply = (asCopy: boolean) => {
    if (!cached) return;
    const app = useApp.getState();
    if (asCopy) {
      const copy = cloneResume(resume, jobLabel(job) === 'Untitled job' ? `${resume.label} (tailored)` : jobLabel(job));
      applyChanges(copy, chosen);
      app.addResume(copy);
      if (job.id) app.updateJob(job.id, { resumeId: copy.id });
      toast(`Saved as a new version: "${copy.label}".`);
    } else {
      app.updateResume((r) => applyChanges(r, chosen));
      toast(`${chosen.length} change${chosen.length === 1 ? '' : 's'} applied.`);
    }
    setCache(cacheKey, undefined);
    navigate('/app/resume');
  };

  const addSkill = (term: string) => {
    useApp.getState().updateResume((r) => {
      const last = r.skills[r.skills.length - 1];
      if (last) last.items = last.items.trim() ? `${last.items.replace(/,\s*$/, '')}, ${term}` : term;
      else r.skills.push({ id: uid(), name: 'Skills', items: term });
    });
    toast(`Added "${term}" to your skills.`);
  };

  const tone = match ? scoreLabel(match.score) : null;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tailor to a job</h1>
        <p>Paste a job description to see how well your resume matches it, then let AI rewrite the parts that matter. Nothing is invented: every suggestion is shown for you to accept or reject.</p>
      </header>
      <JobBar />

      {!jdReady ? (
        <Empty icon="target" title="Paste a job description to begin">
          The match score and missing keywords are free and instant. Use the job post's full text for the most accurate result.
        </Empty>
      ) : null}

      {match && tone ? (
        <div className="card pad match">
          <div className="match-score">
            <ScoreRing score={match.score} size={108} label="Match score" />
            <div>
              <h2>{tone.label}</h2>
              <p className="muted">
                Your resume covers {match.matched.length} of {match.totalKeywords} keywords this job stresses.
                {match.titleMatch === false ? ' The job title does not appear in your resume; consider reflecting it in your headline if it is accurate.' : ''}
              </p>
              <p className="muted small">
                Using <strong>{resume.label}</strong>. Aim for 70+; a perfect 100 usually means keyword stuffing, which recruiters notice.
              </p>
            </div>
          </div>
          <div className="match-cols">
            <div>
              <h3>
                Missing <span className="count">{match.missing.length}</span>
              </h3>
              <p className="muted small">Click a keyword to add it to your skills, only if it is true for you.</p>
              <div className="chips">
                {match.missing.length ? match.missing.map((k) => <Chip key={k.term} tone="miss" onClick={() => addSkill(k.term)} title="Add to my skills">+ {k.term}</Chip>) : <span className="muted small">Nothing important is missing.</span>}
              </div>
            </div>
            <div>
              <h3>
                Already in your resume <span className="count">{match.matched.length}</span>
              </h3>
              <div className="chips">
                {match.matched.map((k) => (
                  <Chip key={k.term} tone="good">
                    {k.term}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {jdReady ? (
        <div className="card pad ai-card">
          <div className="row row-between">
            <div>
              <h2>
                <Icon name="spark" /> Rewrite for this job with AI
              </h2>
              <p className="muted">Rewrites your summary and the most relevant bullets in the job's own language, reorders skills, and lists what is still missing.</p>
            </div>
            <Button variant="ai" size="lg" icon="spark" busy={busy} onClick={tailor} data-testid="tailor-btn">
              {cached ? 'Tailor again' : 'Tailor my resume'}
            </Button>
          </div>
          <AiNote />
        </div>
      ) : null}

      {cached ? (
        <div className="stack">
          {cached.result.note ? (
            <div className="notice">
              <Icon name="info" /> {cached.result.note}
            </div>
          ) : null}
          {cached.result.missingKeywords.length ? (
            <div className="card pad">
              <h3>Still missing after tailoring</h3>
              <p className="muted small">AI will not add these for you, because it cannot know whether they are true. Add the ones you genuinely have.</p>
              <div className="chips">
                {cached.result.missingKeywords.map((k) => (
                  <Chip key={k} tone="miss" onClick={() => addSkill(k)} title="Add to my skills">
                    + {k}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {cached.changes.length ? (
            <>
              <h2 className="section-title">Suggested changes ({chosen.length} of {cached.changes.length} selected)</h2>
              {cached.changes.map((c) => (
                <label key={c.key} className={`change${(picked[c.key] ?? !c.warning) ? ' on' : ''}`}>
                  <input type="checkbox" checked={picked[c.key] ?? !c.warning} onChange={(e) => setPicked((p) => ({ ...p, [c.key]: e.target.checked }))} />
                  <div className="change-body">
                    <div className="change-label">{c.label}</div>
                    {c.before.trim() ? <p className="change-before">{c.before}</p> : null}
                    <p className="change-after">{c.after}</p>
                    <p className="change-reason">{c.reason}</p>
                    {c.warning ? (
                      <p className="change-warning">
                        <Icon name="warn" size={14} /> {c.warning}
                      </p>
                    ) : null}
                  </div>
                </label>
              ))}
              <div className="apply-bar">
                <Button variant="primary" size="lg" icon="check" disabled={!chosen.length} onClick={() => apply(true)} data-testid="apply-copy">
                  Save as a new tailored version
                </Button>
                <Button size="lg" disabled={!chosen.length} onClick={() => apply(false)}>
                  Apply to this resume
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
