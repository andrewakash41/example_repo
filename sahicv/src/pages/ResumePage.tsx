import { useEffect, useMemo, useRef, useState } from 'react';
import type { Resume } from '../../shared/types.ts';
import { checkResume } from '../analysis/ats.ts';
import { runAi } from '../api.ts';
import { CheckPanel, DesignPanel } from '../components/design.tsx';
import {
  BasicsEditor,
  BulletList,
  CertificationsEditor,
  CustomEditor,
  EducationEditor,
  ExperienceEditor,
  ProjectsEditor,
  Section,
  SkillsEditor,
  SummaryEditor,
} from '../components/editor.tsx';
import { AiNote } from '../components/pass.tsx';
import { Button, Icon, Input, Modal, TextArea, downloadBlob } from '../components/ui.tsx';
import { PagesPreview, useResumeLayout } from '../resume/engine/Preview.tsx';
import { layoutToPdfBlob } from '../resume/engine/pdf.ts';
import { emptyResume, normalizeResume, sampleResume, uid } from '../resume/model.ts';
import { fileSafe, resumeToMarkdown, resumeToText } from '../resume/text.ts';
import { useActiveResume, useApp, useUi } from '../store.ts';

type Panel = 'content' | 'design' | 'check';

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let last: number | null = null;
    let text = '';
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(item.transform[5]);
      if (last !== null && Math.abs(y - last) > 2) text += '\n';
      else if (text && !text.endsWith(' ') && !text.endsWith('\n')) text += ' ';
      text += item.str;
      last = y;
    }
    pages.push(text);
  }
  return pages.join('\n');
}

function ImportModal({ onClose }: { onClose(): void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const addResume = useApp((s) => s.addResume);
  const toast = useUi((s) => s.toast);

  const onFile = async (file: File) => {
    setNote('');
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const data = JSON.parse(await file.text());
        const r = normalizeResume(data.resume ?? data);
        r.id = uid();
        r.label = r.label || 'Imported resume';
        addResume(r);
        toast('Backup loaded.');
        onClose();
        return;
      }
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setNote('Reading the PDF…');
        const t = await pdfText(file);
        setText(t);
        setNote(t.trim().length > 80 ? 'Text extracted. Check it below, then click Import.' : 'This PDF has no selectable text (it may be a scan). Paste the text instead.');
        return;
      }
      setText(await file.text());
      setNote('Text loaded. Check it below, then click Import.');
    } catch {
      setNote('Could not read that file. Paste the text of your resume instead.');
    }
  };

  const run = async () => {
    setBusy(true);
    const res = await runAi<{ resume: Resume }>('parse-resume', { text });
    setBusy(false);
    if (!res) return;
    const r = normalizeResume(res.resume);
    r.id = uid();
    r.label = r.basics.name ? `${r.basics.name.split(' ')[0]}'s resume` : 'Imported resume';
    addResume(r);
    toast('Resume imported. Review each section for accuracy.');
    onClose();
  };

  return (
    <Modal title="Import your existing resume" onClose={onClose}>
      <div className="stack">
        <p className="muted">Upload a PDF or paste the text. AI sorts it into sections without changing your wording. This uses 1 AI action.</p>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.json,application/pdf,text/plain,application/json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="row">
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Choose PDF, text or backup file
          </Button>
          {note ? <span className="muted small">{note}</span> : null}
        </div>
        <TextArea value={text} onChange={setText} minRows={8} placeholder="…or paste your resume text here" aria-label="Resume text" style={{ maxHeight: 280 }} />
        <div className="row row-between">
          <AiNote />
          <Button variant="ai" icon="spark" busy={busy} disabled={text.trim().length < 80} onClick={run}>
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DownloadMenu({ resume, onPdf, busy }: { resume: Resume; onPdf(): void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const toast = useUi((s) => s.toast);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const base = `${fileSafe(resume.basics.name)}_Resume`;
  const save = async (kind: 'docx' | 'txt' | 'md' | 'json') => {
    setOpen(false);
    try {
      if (kind === 'docx') {
        const { resumeToDocx } = await import('../resume/export/docx.ts');
        downloadBlob(await resumeToDocx(resume), `${base}.docx`);
      } else if (kind === 'txt') {
        downloadBlob(new Blob([resumeToText(resume)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      } else if (kind === 'md') {
        downloadBlob(new Blob([resumeToMarkdown(resume)], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
      } else {
        downloadBlob(new Blob([JSON.stringify({ app: 'SahiCV', version: 1, resume }, null, 2)], { type: 'application/json' }), `${base}_backup.json`);
      }
    } catch {
      toast('Could not create that file. Please try again.', 'error');
    }
  };
  return (
    <div className="menu-wrap" ref={ref}>
      <div className="split-btn">
        <Button variant="primary" icon="download" busy={busy} onClick={onPdf} data-testid="download-pdf">
          Download PDF
        </Button>
        <button className="btn btn-primary split-caret" aria-label="More download formats" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {open ? (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => save('docx')}>
            <strong>Word (.docx)</strong>
            <small>Editable; some job portals ask for it</small>
          </button>
          <button role="menuitem" onClick={() => save('txt')}>
            <strong>Plain text (.txt)</strong>
            <small>For pasting into application forms</small>
          </button>
          <button role="menuitem" onClick={() => save('md')}>
            <strong>Markdown (.md)</strong>
            <small>For GitHub or notes apps</small>
          </button>
          <button role="menuitem" onClick={() => save('json')}>
            <strong>Backup (.json)</strong>
            <small>Move your resume to another device</small>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ResumeBar({ onImport }: { onImport(): void }) {
  const resumes = useApp((s) => s.resumes);
  const active = useActiveResume();
  const { setActiveResume, addResume, duplicateResume, deleteResume, updateResume } = useApp.getState();
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="resume-bar">
      {renaming ? (
        <Input value={active.label} onChange={(v) => updateResume((r) => void (r.label = v))} onBlur={() => setRenaming(false)} onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)} autoFocus aria-label="Resume name" />
      ) : (
        <select className="input select" value={active.id} onChange={(e) => setActiveResume(e.target.value)} aria-label="Choose resume version">
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      )}
      <div className="row">
        <Button size="sm" variant="ghost" icon="edit" onClick={() => setRenaming(true)}>
          Rename
        </Button>
        <Button size="sm" variant="ghost" icon="copy" onClick={() => duplicateResume(`${active.label} (copy)`)}>
          Duplicate
        </Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => addResume(emptyResume('New resume'))}>
          New
        </Button>
        <Button size="sm" variant="ghost" icon="upload" onClick={onImport}>
          Import
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          onClick={() => {
            if (window.confirm(`Delete "${active.label}"? This cannot be undone.`)) deleteResume(active.id);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export default function ResumePage() {
  const resume = useActiveResume();
  const update = useApp((s) => s.updateResume);
  const toast = useUi((s) => s.toast);
  const { layout, font } = useResumeLayout(resume);
  const [panel, setPanel] = useState<Panel>('content');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const pages = layout?.pages.length ?? 1;
  const report = useMemo(() => checkResume(resume, pages), [resume, pages]);
  const isSample = resume.label === 'Sample resume';

  const downloadPdf = async () => {
    if (!layout || !font) return;
    setSaving(true);
    try {
      const blob = await layoutToPdfBlob(layout, font.id, font.data, {
        title: `${resume.basics.name || 'Resume'} – Resume`,
        author: resume.basics.name,
        subject: resume.basics.headline,
        keywords: resume.skills.map((g) => g.items).join(', ').slice(0, 400),
      });
      downloadBlob(blob, `${fileSafe(resume.basics.name)}_Resume.pdf`);
    } catch {
      toast('Could not create the PDF. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`builder view-${mobileView}`}>
      <div className="builder-left">
        {isSample ? (
          <div className="notice notice-start">
            <strong>This is a sample resume.</strong> Edit it, or start with your own:
            <div className="row">
              <Button size="sm" variant="primary" icon="upload" onClick={() => setImporting(true)}>
                Import my resume
              </Button>
              <Button size="sm" icon="plus" onClick={() => useApp.getState().addResume(emptyResume('My resume'))}>
                Start blank
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update((r) => void (r.label = 'My resume'))}>
                Keep editing the sample
              </Button>
            </div>
          </div>
        ) : null}
        <ResumeBar onImport={() => setImporting(true)} />
        <div className="tabs" role="tablist">
          {(
            [
              ['content', 'Content', 'edit'],
              ['design', 'Design', 'palette'],
              ['check', `Check · ${report.score}`, 'shield'],
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} role="tab" aria-selected={panel === id} className={panel === id ? 'on' : ''} onClick={() => setPanel(id)}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>

        {panel === 'content' ? (
          <div className="stack">
            <Section id="basics" title="Contact details" defaultOpen>
              <BasicsEditor r={resume} update={update} />
            </Section>
            <Section id="summary" title="Summary" defaultOpen>
              <SummaryEditor r={resume} update={update} />
            </Section>
            <Section id="experience" title="Work experience" count={resume.experience.length} defaultOpen>
              <ExperienceEditor r={resume} update={update} />
            </Section>
            <Section id="education" title="Education" count={resume.education.length}>
              <EducationEditor r={resume} update={update} />
            </Section>
            <Section id="projects" title="Projects" count={resume.projects.length}>
              <ProjectsEditor r={resume} update={update} />
            </Section>
            <Section id="skills" title="Skills" count={resume.skills.length}>
              <SkillsEditor r={resume} update={update} />
            </Section>
            <Section id="certifications" title="Certifications" count={resume.certifications.length}>
              <CertificationsEditor r={resume} update={update} />
            </Section>
            <Section id="achievements" title="Achievements" count={resume.achievements.filter((a) => a.trim()).length}>
              <BulletList bullets={resume.achievements.length ? resume.achievements : ['']} ai={false} placeholder="Award, rank, publication or recognition" onChange={(next) => update((x) => void (x.achievements = next))} />
            </Section>
            <Section id="languages" title="Languages">
              <Input value={resume.languages} onChange={(v) => update((x) => void (x.languages = v))} placeholder="English (fluent), Hindi (native), Marathi (conversational)" aria-label="Languages" />
            </Section>
            <Section id="custom" title="More sections" count={resume.custom.length}>
              <CustomEditor r={resume} update={update} />
            </Section>
            <div className="row row-between pad-x">
              <AiNote />
              <button className="link-btn" onClick={() => useApp.getState().addResume({ ...sampleResume(), label: 'Sample resume' })}>
                Load the sample again
              </button>
            </div>
          </div>
        ) : null}
        {panel === 'design' ? <DesignPanel r={resume} update={update} /> : null}
        {panel === 'check' ? <CheckPanel report={report} /> : null}
      </div>

      <div className="builder-right">
        <div className="preview-bar">
          <div className="preview-meta">
            <span className={`pill ${pages > 2 ? 'pill-warn' : ''}`}>
              {pages} page{pages === 1 ? '' : 's'}
            </span>
            <button className={`pill pill-btn pill-${report.score >= 85 ? 'good' : report.score >= 65 ? 'ok' : 'low'}`} onClick={() => setPanel('check')} title="Open the resume check">
              Score {report.score}
            </button>
            <span className="muted small hide-sm">What you see is exactly what downloads</span>
          </div>
          <DownloadMenu resume={resume} onPdf={downloadPdf} busy={saving} />
        </div>
        <div className="preview-scroll">
          <PagesPreview layout={layout} fontId={resume.design.font} />
        </div>
      </div>

      <div className="mobile-switch" role="tablist" aria-label="Editor or preview">
        <button role="tab" aria-selected={mobileView === 'edit'} className={mobileView === 'edit' ? 'on' : ''} onClick={() => setMobileView('edit')}>
          <Icon name="edit" size={16} /> Edit
        </button>
        <button role="tab" aria-selected={mobileView === 'preview'} className={mobileView === 'preview' ? 'on' : ''} onClick={() => setMobileView('preview')}>
          <Icon name="eye" size={16} /> Preview & download
        </button>
      </div>

      {importing ? <ImportModal onClose={() => setImporting(false)} /> : null}
    </div>
  );
}
