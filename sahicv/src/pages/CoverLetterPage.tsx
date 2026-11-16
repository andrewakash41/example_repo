import { useMemo, useState } from 'react';
import { runAi } from '../api.ts';
import { JobBar, useJob } from '../components/jobs.tsx';
import { AiNote } from '../components/pass.tsx';
import { Button, CopyButton, Empty, TextArea, downloadBlob } from '../components/ui.tsx';
import { PagesPreview, useDocLayout } from '../resume/engine/Preview.tsx';
import { layoutToPdfBlob } from '../resume/engine/pdf.ts';
import { buildLetterDoc } from '../resume/templates.ts';
import { fileSafe } from '../resume/text.ts';
import { useActiveResume, useApp, useUi } from '../store.ts';

const TONES = [
  ['professional', 'Professional'],
  ['warm', 'Warm'],
  ['confident', 'Confident'],
] as const;

export default function CoverLetterPage() {
  const resume = useActiveResume();
  const job = useJob();
  const toast = useUi((s) => s.toast);
  const [tone, setTone] = useState<string>('professional');
  const [length, setLength] = useState<'standard' | 'short'>('standard');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const letter = job.coverLetter ?? '';
  const b = resume.basics;

  const today = useMemo(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), []);
  const contact = [b.phone, b.email, b.location].filter(Boolean).join('  |  ');
  const spec = useMemo(
    () => (letter.trim() ? buildLetterDoc({ name: b.name || 'Your Name', contact, date: today, body: letter, design: resume.design }) : null),
    [letter, b.name, contact, today, resume.design],
  );
  const { layout, font } = useDocLayout(spec, resume.design.font);
  const base = `${fileSafe(b.name)}_Cover_Letter${job.company ? '_' + fileSafe(job.company) : ''}`;

  const generate = async () => {
    setBusy(true);
    const res = await runAi<{ letter: string }>('cover-letter', { resume, jd: job.jd, role: job.role, company: job.company, tone, length });
    setBusy(false);
    if (res?.letter && job.id) useApp.getState().updateJob(job.id, { coverLetter: res.letter });
  };

  const pdf = async () => {
    if (!layout || !font) return;
    setSaving(true);
    try {
      downloadBlob(await layoutToPdfBlob(layout, font.id, font.data, { title: `${b.name} – Cover letter`, author: b.name }), `${base}.pdf`);
    } catch {
      toast('Could not create the PDF. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };
  const docx = async () => {
    const { letterToDocx } = await import('../resume/export/docx.ts');
    downloadBlob(await letterToDocx(b.name || 'Your Name', contact, today, letter, resume.design.font), `${base}.docx`);
  };

  const ready = job.jd.trim().length >= 40 || job.role.trim().length > 1;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Cover letter</h1>
        <p>A letter written from your real achievements for this specific job, in the same style as your resume. Edit it freely before you send it.</p>
      </header>
      <JobBar collapsible />
      <div className="card pad ai-card">
        <div className="row row-between">
          <div className="row">
            <div className="seg" aria-label="Tone">
              {TONES.map(([id, label]) => (
                <button key={id} className={tone === id ? 'on' : ''} onClick={() => setTone(id)} aria-pressed={tone === id}>
                  {label}
                </button>
              ))}
            </div>
            <div className="seg" aria-label="Length">
              <button className={length === 'standard' ? 'on' : ''} onClick={() => setLength('standard')} aria-pressed={length === 'standard'}>
                Standard
              </button>
              <button className={length === 'short' ? 'on' : ''} onClick={() => setLength('short')} aria-pressed={length === 'short'}>
                Short
              </button>
            </div>
          </div>
          <Button variant="ai" size="lg" icon="spark" busy={busy} disabled={!ready} onClick={generate} data-testid="letter-btn">
            {letter ? 'Write again' : 'Write my cover letter'}
          </Button>
        </div>
        <AiNote />
      </div>

      {!letter ? (
        <Empty icon="mail" title="No letter yet">
          {ready ? 'Choose a tone and click the button above. It uses your current resume and this job description.' : 'Add the job title or paste the job description first.'}
        </Empty>
      ) : (
        <div className="letter-grid">
          <div className="card pad">
            <TextArea value={letter} onChange={(v) => job.id && useApp.getState().updateJob(job.id, { coverLetter: v })} minRows={14} aria-label="Cover letter text" />
            <div className="row row-between">
              <span className="muted small">{letter.trim().split(/\s+/).length} words</span>
              <div className="row">
                <CopyButton text={letter} />
                <Button size="sm" onClick={() => downloadBlob(new Blob([letter], { type: 'text/plain;charset=utf-8' }), `${base}.txt`)}>
                  Text
                </Button>
                <Button size="sm" onClick={docx}>
                  Word
                </Button>
                <Button size="sm" variant="primary" icon="download" busy={saving} onClick={pdf}>
                  PDF
                </Button>
              </div>
            </div>
          </div>
          <div className="letter-preview">
            <PagesPreview layout={layout} fontId={resume.design.font} />
          </div>
        </div>
      )}
    </div>
  );
}
