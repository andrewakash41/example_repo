import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Resume } from '../../shared/types.ts';
import { runAi } from '../api.ts';
import { uid } from '../resume/model.ts';
import { useApp } from '../store.ts';
import { Button, Field, Icon, IconButton, Input, TextArea } from './ui.tsx';

type Update = (mutate: (r: Resume) => void) => void;

function move<T>(arr: T[], from: number, to: number) {
  if (to < 0 || to >= arr.length) return;
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
}

export function Section({ title, count, children, defaultOpen = false, id }: { title: string; count?: number; children: ReactNode; defaultOpen?: boolean; id: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`card sec${open ? ' sec-open' : ''}`} data-section={id}>
      <button className="sec-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="sec-title">{title}</span>
        {count !== undefined && count > 0 ? <span className="sec-count">{count}</span> : null}
        <span className="sec-chevron">
          <Icon name="chevron" />
        </span>
      </button>
      {open ? <div className="sec-body">{children}</div> : null}
    </section>
  );
}

function Suggestions({ options, onPick, onClose }: { options: string[]; onPick(v: string): void; onClose(): void }) {
  return (
    <div className="suggestions">
      <div className="suggestions-head">
        <span>
          <Icon name="spark" size={14} /> Pick a version (you can edit it afterwards)
        </span>
        <IconButton icon="x" label="Dismiss suggestions" onClick={onClose} />
      </div>
      {options.map((o, i) => (
        <button key={i} className="suggestion" onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function BulletList({
  bullets,
  onChange,
  context,
  placeholder = 'What you did and the result, with a number if you can',
  ai = true,
}: {
  bullets: string[];
  onChange(next: string[]): void;
  context?: string;
  placeholder?: string;
  ai?: boolean;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [options, setOptions] = useState<{ index: number; items: string[] } | null>(null);
  const jd = useApp((s) => s.jobs.find((j) => j.id === s.activeJobId)?.jd ?? '');

  const set = (i: number, v: string) => onChange(bullets.map((b, j) => (j === i ? v : b)));
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const next = [...bullets];
      next.splice(i + 1, 0, '');
      onChange(next);
      requestAnimationFrame(() => {
        const list = (e.target as HTMLElement).closest('.bullets');
        list?.querySelectorAll<HTMLTextAreaElement>('textarea')[i + 1]?.focus();
      });
    } else if (e.key === 'Backspace' && bullets[i] === '' && bullets.length > 1) {
      e.preventDefault();
      onChange(bullets.filter((_, j) => j !== i));
    }
  };

  const improve = async (i: number) => {
    setBusy(i);
    setOptions(null);
    const res = await runAi<{ options: string[] }>('improve-bullet', { bullet: bullets[i], context, jd });
    setBusy(null);
    if (res?.options.length) setOptions({ index: i, items: res.options });
  };

  return (
    <div className="bullets">
      {bullets.map((b, i) => (
        <div key={i} className="bullet-row-wrap">
          <div className="bullet-row">
            <span className="bullet-dot" aria-hidden="true">
              •
            </span>
            <TextArea value={b} onChange={(v) => set(i, v)} minRows={1} placeholder={placeholder} onKeyDown={(e) => onKey(e, i)} aria-label={`Bullet ${i + 1}`} />
            <div className="bullet-actions">
              {ai ? (
                <button className="icon-btn icon-btn-ai" title="Improve with AI" aria-label="Improve with AI" disabled={busy !== null || b.trim().length < 5} onClick={() => improve(i)}>
                  {busy === i ? <span className="spinner" /> : <Icon name="spark" size={16} />}
                </button>
              ) : null}
              <IconButton icon="up" label="Move up" disabled={i === 0} onClick={() => onChange(swap(bullets, i, i - 1))} />
              <IconButton icon="trash" label="Delete bullet" onClick={() => onChange(bullets.filter((_, j) => j !== i))} />
            </div>
          </div>
          {options?.index === i ? (
            <Suggestions
              options={options.items}
              onClose={() => setOptions(null)}
              onPick={(v) => {
                set(i, v);
                setOptions(null);
              }}
            />
          ) : null}
        </div>
      ))}
      <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange([...bullets, ''])}>
        Add bullet
      </Button>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function EntryShell({ title, subtitle, onUp, onDown, onDelete, children, startOpen }: { title: string; subtitle?: string; onUp?(): void; onDown?(): void; onDelete(): void; children: ReactNode; startOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(startOpen));
  return (
    <div className={`entry${open ? ' entry-open' : ''}`}>
      <div className="entry-head">
        <button className="entry-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="sec-chevron">
            <Icon name="chevron" size={16} />
          </span>
          <span className="entry-title">{title}</span>
          {subtitle ? <span className="entry-sub">{subtitle}</span> : null}
        </button>
        <div className="entry-actions">
          {onUp ? <IconButton icon="up" label="Move up" onClick={onUp} /> : null}
          {onDown ? <IconButton icon="down" label="Move down" onClick={onDown} /> : null}
          <IconButton icon="trash" label="Delete" onClick={onDelete} />
        </div>
      </div>
      {open ? <div className="entry-body">{children}</div> : null}
    </div>
  );
}

export function BasicsEditor({ r, update }: { r: Resume; update: Update }) {
  const b = r.basics;
  return (
    <div className="grid2">
      <Field label="Full name">
        <Input value={b.name} onChange={(v) => update((x) => void (x.basics.name = v))} placeholder="Ananya Iyer" autoComplete="name" />
      </Field>
      <Field label="Headline" hint="Your role or the role you want">
        <Input value={b.headline} onChange={(v) => update((x) => void (x.basics.headline = v))} placeholder="Data Analyst · SQL, Power BI" />
      </Field>
      <Field label="Email">
        <Input type="email" value={b.email} onChange={(v) => update((x) => void (x.basics.email = v))} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={b.phone} onChange={(v) => update((x) => void (x.basics.phone = v))} placeholder="+91 98765 43210" autoComplete="tel" />
      </Field>
      <Field label="City" wide>
        <Input value={b.location} onChange={(v) => update((x) => void (x.basics.location = v))} placeholder="Pune, Maharashtra" />
      </Field>
      <div className="field field-wide">
        <span className="field-label">Links (LinkedIn, GitHub, portfolio)</span>
        {b.links.map((l, i) => (
          <div className="row" key={i}>
            <Input
              value={l.url}
              onChange={(v) => update((x) => void (x.basics.links[i].url = v))}
              placeholder="linkedin.com/in/your-name"
              aria-label={`Link ${i + 1}`}
              inputMode="url"
            />
            <IconButton icon="trash" label="Remove link" onClick={() => update((x) => void x.basics.links.splice(i, 1))} />
          </div>
        ))}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => update((x) => void x.basics.links.push({ label: '', url: '' }))}>
          Add link
        </Button>
      </div>
    </div>
  );
}

export function SummaryEditor({ r, update }: { r: Resume; update: Update }) {
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);
  const job = useApp((s) => s.jobs.find((j) => j.id === s.activeJobId) ?? null);
  const write = async () => {
    setBusy(true);
    setOptions(null);
    const res = await runAi<{ options: string[] }>('summary', { resume: r, role: job?.role ?? '', jd: job?.jd ?? '' });
    setBusy(false);
    if (res?.options.length) setOptions(res.options);
  };
  return (
    <div className="stack">
      <TextArea
        value={r.basics.summary}
        onChange={(v) => update((x) => void (x.basics.summary = v))}
        minRows={4}
        placeholder="2–4 lines: who you are, your strongest skills and one result. Example: Data analyst with 3 years in e-commerce; built dashboards that cut reporting time by 60%."
        aria-label="Summary"
      />
      <div className="row row-between">
        <Button variant="ai" size="sm" icon="spark" busy={busy} onClick={write}>
          {r.basics.summary.trim() ? 'Rewrite with AI' : 'Write with AI'}
        </Button>
        <span className="muted small">{r.basics.summary.trim().split(/\s+/).filter(Boolean).length} words · aim for 30–70</span>
      </div>
      {options ? (
        <Suggestions
          options={options}
          onClose={() => setOptions(null)}
          onPick={(v) => {
            update((x) => void (x.basics.summary = v));
            setOptions(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function ExperienceEditor({ r, update }: { r: Resume; update: Update }) {
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="stack">
      {r.experience.map((e, i) => (
        <EntryShell
          key={e.id}
          title={e.title || 'New role'}
          subtitle={e.company}
          startOpen={e.id === fresh}
          onUp={i > 0 ? () => update((x) => move(x.experience, i, i - 1)) : undefined}
          onDown={i < r.experience.length - 1 ? () => update((x) => move(x.experience, i, i + 1)) : undefined}
          onDelete={() => update((x) => void x.experience.splice(i, 1))}
        >
          <div className="grid2">
            <Field label="Job title">
              <Input value={e.title} onChange={(v) => update((x) => void (x.experience[i].title = v))} placeholder="Software Engineer" />
            </Field>
            <Field label="Company">
              <Input value={e.company} onChange={(v) => update((x) => void (x.experience[i].company = v))} placeholder="Company name" />
            </Field>
            <Field label="Start">
              <Input value={e.start} onChange={(v) => update((x) => void (x.experience[i].start = v))} placeholder="Jun 2022" />
            </Field>
            <Field label="End">
              <Input value={e.current ? 'Present' : e.end} disabled={e.current} onChange={(v) => update((x) => void (x.experience[i].end = v))} placeholder="Mar 2024" />
            </Field>
            <Field label="City">
              <Input value={e.location} onChange={(v) => update((x) => void (x.experience[i].location = v))} placeholder="Bengaluru" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={e.current} onChange={(ev) => update((x) => void (x.experience[i].current = ev.target.checked))} />I work here now
            </label>
          </div>
          <span className="field-label">What you achieved</span>
          <BulletList bullets={e.bullets} context={[e.title, e.company].filter(Boolean).join(' at ') + (e.current ? ' (current role)' : '')} onChange={(next) => update((x) => void (x.experience[i].bullets = next))} />
        </EntryShell>
      ))}
      <Button
        icon="plus"
        onClick={() => {
          const id = uid();
          setFresh(id);
          update((x) => void x.experience.push({ id, title: '', company: '', location: '', start: '', end: '', current: false, bullets: [''] }));
        }}
      >
        Add work experience or internship
      </Button>
    </div>
  );
}

export function EducationEditor({ r, update }: { r: Resume; update: Update }) {
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="stack">
      {r.education.map((e, i) => (
        <EntryShell
          key={e.id}
          title={e.degree || 'New qualification'}
          subtitle={e.school}
          startOpen={e.id === fresh}
          onUp={i > 0 ? () => update((x) => move(x.education, i, i - 1)) : undefined}
          onDelete={() => update((x) => void x.education.splice(i, 1))}
        >
          <div className="grid2">
            <Field label="Degree / course" wide>
              <Input value={e.degree} onChange={(v) => update((x) => void (x.education[i].degree = v))} placeholder="B.Tech Computer Science" />
            </Field>
            <Field label="College / school">
              <Input value={e.school} onChange={(v) => update((x) => void (x.education[i].school = v))} placeholder="University name" />
            </Field>
            <Field label="City">
              <Input value={e.location} onChange={(v) => update((x) => void (x.education[i].location = v))} placeholder="Chennai" />
            </Field>
            <Field label="Start year">
              <Input value={e.start} onChange={(v) => update((x) => void (x.education[i].start = v))} placeholder="2019" />
            </Field>
            <Field label="End year">
              <Input value={e.end} onChange={(v) => update((x) => void (x.education[i].end = v))} placeholder="2023" />
            </Field>
            <Field label="Score" wide hint="CGPA or percentage, if it helps you">
              <Input value={e.score} onChange={(v) => update((x) => void (x.education[i].score = v))} placeholder="CGPA 8.4/10" />
            </Field>
          </div>
        </EntryShell>
      ))}
      <Button
        icon="plus"
        onClick={() => {
          const id = uid();
          setFresh(id);
          update((x) => void x.education.push({ id, degree: '', school: '', location: '', start: '', end: '', score: '' }));
        }}
      >
        Add education
      </Button>
    </div>
  );
}

export function ProjectsEditor({ r, update }: { r: Resume; update: Update }) {
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="stack">
      {r.projects.map((p, i) => (
        <EntryShell
          key={p.id}
          title={p.name || 'New project'}
          subtitle={p.tech}
          startOpen={p.id === fresh}
          onUp={i > 0 ? () => update((x) => move(x.projects, i, i - 1)) : undefined}
          onDelete={() => update((x) => void x.projects.splice(i, 1))}
        >
          <div className="grid2">
            <Field label="Project name">
              <Input value={p.name} onChange={(v) => update((x) => void (x.projects[i].name = v))} placeholder="Expense Tracker App" />
            </Field>
            <Field label="Link">
              <Input value={p.link} onChange={(v) => update((x) => void (x.projects[i].link = v))} placeholder="github.com/you/project" inputMode="url" />
            </Field>
            <Field label="Tools used" wide>
              <Input value={p.tech} onChange={(v) => update((x) => void (x.projects[i].tech = v))} placeholder="React, Node.js, MongoDB" />
            </Field>
            <Field label="Start">
              <Input value={p.start} onChange={(v) => update((x) => void (x.projects[i].start = v))} placeholder="2024" />
            </Field>
            <Field label="End">
              <Input value={p.end} onChange={(v) => update((x) => void (x.projects[i].end = v))} placeholder="" />
            </Field>
          </div>
          <span className="field-label">What you built and the result</span>
          <BulletList bullets={p.bullets} context={`Project: ${p.name}`} onChange={(next) => update((x) => void (x.projects[i].bullets = next))} />
        </EntryShell>
      ))}
      <Button
        icon="plus"
        onClick={() => {
          const id = uid();
          setFresh(id);
          update((x) => void x.projects.push({ id, name: '', link: '', tech: '', start: '', end: '', bullets: [''] }));
        }}
      >
        Add project
      </Button>
    </div>
  );
}

export function SkillsEditor({ r, update }: { r: Resume; update: Update }) {
  return (
    <div className="stack">
      {r.skills.map((g, i) => (
        <div className="skill-row" key={g.id}>
          <Input value={g.name} onChange={(v) => update((x) => void (x.skills[i].name = v))} placeholder="Group, e.g. Tools" aria-label="Skill group name" />
          <TextArea value={g.items} onChange={(v) => update((x) => void (x.skills[i].items = v))} minRows={1} placeholder="Excel, SQL, Power BI" aria-label="Skills, comma separated" />
          <IconButton icon="trash" label="Remove group" onClick={() => update((x) => void x.skills.splice(i, 1))} />
        </div>
      ))}
      <Button icon="plus" onClick={() => update((x) => void x.skills.push({ id: uid(), name: x.skills.length ? '' : 'Skills', items: '' }))}>
        Add skill group
      </Button>
      <p className="muted small">Separate skills with commas. Use the exact words from the job description where they are true for you.</p>
    </div>
  );
}

export function CertificationsEditor({ r, update }: { r: Resume; update: Update }) {
  return (
    <div className="stack">
      {r.certifications.map((c, i) => (
        <div className="cert-row" key={c.id}>
          <Input value={c.name} onChange={(v) => update((x) => void (x.certifications[i].name = v))} placeholder="Certification name" aria-label="Certification name" />
          <Input value={c.issuer} onChange={(v) => update((x) => void (x.certifications[i].issuer = v))} placeholder="Issued by" aria-label="Issuer" />
          <Input value={c.date} onChange={(v) => update((x) => void (x.certifications[i].date = v))} placeholder="2024" aria-label="Year" />
          <IconButton icon="trash" label="Remove" onClick={() => update((x) => void x.certifications.splice(i, 1))} />
        </div>
      ))}
      <Button icon="plus" onClick={() => update((x) => void x.certifications.push({ id: uid(), name: '', issuer: '', date: '' }))}>
        Add certification
      </Button>
    </div>
  );
}

export function CustomEditor({ r, update }: { r: Resume; update: Update }) {
  return (
    <div className="stack">
      {r.custom.map((c, i) => (
        <EntryShell
          key={c.id}
          title={c.title || 'New section'}
          startOpen
          onDelete={() =>
            update((x) => {
              x.order = x.order.filter((k) => k !== `custom:${c.id}`);
              x.custom.splice(i, 1);
            })
          }
        >
          <Field label="Section title">
            <Input value={c.title} onChange={(v) => update((x) => void (x.custom[i].title = v))} placeholder="Volunteering, Publications, Hobbies…" />
          </Field>
          <BulletList bullets={c.bullets} ai={false} placeholder="Add a line" onChange={(next) => update((x) => void (x.custom[i].bullets = next))} />
        </EntryShell>
      ))}
      <Button
        icon="plus"
        onClick={() =>
          update((x) => {
            const id = uid();
            x.custom.push({ id, title: '', bullets: [''] });
            x.order.push(`custom:${id}`);
          })
        }
      >
        Add your own section
      </Button>
    </div>
  );
}
