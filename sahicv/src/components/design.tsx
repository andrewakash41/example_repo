import type { Resume, Spacing } from '../../shared/types.ts';
import type { AtsReport } from '../analysis/ats.ts';
import { FONT_FAMILIES } from '../resume/engine/fonts.ts';
import { ACCENTS, TEMPLATES, resumeSectionKeys, sectionTitle } from '../resume/templates.ts';
import { DEFAULT_ORDER, FRESHER_ORDER } from '../resume/model.ts';
import { Button, Icon, IconButton, ScoreRing } from './ui.tsx';

type Update = (mutate: (r: Resume) => void) => void;

export function DesignPanel({ r, update }: { r: Resume; update: Update }) {
  const d = r.design;
  const keys = resumeSectionKeys(r);
  const moveKey = (i: number, dir: -1 | 1) =>
    update((x) => {
      const order = resumeSectionKeys(x);
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      x.order = order;
    });
  const hasContent = (key: string): boolean => {
    switch (key) {
      case 'summary':
        return Boolean(r.basics.summary.trim());
      case 'experience':
        return r.experience.length > 0;
      case 'education':
        return r.education.length > 0;
      case 'projects':
        return r.projects.length > 0;
      case 'skills':
        return r.skills.some((g) => g.items.trim());
      case 'certifications':
        return r.certifications.length > 0;
      case 'achievements':
        return r.achievements.some((a) => a.trim());
      case 'languages':
        return Boolean(r.languages.trim());
      default:
        return true;
    }
  };

  return (
    <div className="stack-lg">
      <div className="card pad">
        <h3 className="panel-title">Template</h3>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`tpl${d.template === t.id ? ' on' : ''}`}
              onClick={() => update((x) => void (x.design = { ...x.design, template: t.id, font: t.font, accent: t.accent }))}
              aria-pressed={d.template === t.id}
            >
              <img src={`/img/tpl-${t.id}.png`} alt="" loading="lazy" />
              <span className="tpl-name">
                {t.name}
                {t.atsSafe ? <span className="badge badge-ok">ATS-safe</span> : <span className="badge badge-warn">2-column</span>}
              </span>
              <span className="tpl-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card pad">
        <h3 className="panel-title">Colour</h3>
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`swatch${d.accent === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Accent colour ${c}`} aria-pressed={d.accent === c} onClick={() => update((x) => void (x.design.accent = c))} />
          ))}
        </div>

        <h3 className="panel-title">Font</h3>
        <div className="seg seg-wrap">
          {FONT_FAMILIES.map((f) => (
            <button key={f.id} className={d.font === f.id ? 'on' : ''} onClick={() => update((x) => void (x.design.font = f.id))} aria-pressed={d.font === f.id}>
              {f.label}
              <small>{f.kind}</small>
            </button>
          ))}
        </div>

        <h3 className="panel-title">
          Text size <span className="muted">{d.fontSize} pt</span>
        </h3>
        <input className="range" type="range" min={8.5} max={12} step={0.5} value={d.fontSize} onChange={(e) => update((x) => void (x.design.fontSize = Number(e.target.value)))} aria-label="Text size" />

        <h3 className="panel-title">Spacing</h3>
        <div className="seg">
          {(['compact', 'normal', 'relaxed'] as Spacing[]).map((s) => (
            <button key={s} className={d.spacing === s ? 'on' : ''} onClick={() => update((x) => void (x.design.spacing = s))} aria-pressed={d.spacing === s}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <h3 className="panel-title">Paper</h3>
        <div className="seg">
          {(['A4', 'Letter'] as const).map((p) => (
            <button key={p} className={d.page === p ? 'on' : ''} onClick={() => update((x) => void (x.design.page = p))} aria-pressed={d.page === p}>
              {p === 'A4' ? 'A4 (India, UK, EU)' : 'Letter (US, Canada)'}
            </button>
          ))}
        </div>
      </div>

      <div className="card pad">
        <h3 className="panel-title">Section order</h3>
        <div className="row">
          <Button size="sm" onClick={() => update((x) => void (x.order = [...DEFAULT_ORDER, ...x.custom.map((c) => `custom:${c.id}`)]))}>
            Experienced: work first
          </Button>
          <Button size="sm" onClick={() => update((x) => void (x.order = [...FRESHER_ORDER, ...x.custom.map((c) => `custom:${c.id}`)]))}>
            Fresher: education first
          </Button>
        </div>
        <ol className="order-list">
          {keys.map((k, i) => (
            <li key={k} className={hasContent(k) ? '' : 'dim'}>
              <span>{sectionTitle(r, k)}</span>
              {!hasContent(k) ? <small>empty</small> : null}
              <span className="order-actions">
                <IconButton icon="up" label={`Move ${sectionTitle(r, k)} up`} disabled={i === 0} onClick={() => moveKey(i, -1)} />
                <IconButton icon="down" label={`Move ${sectionTitle(r, k)} down`} disabled={i === keys.length - 1} onClick={() => moveKey(i, 1)} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const STATUS_ICON = { pass: 'check', warn: 'warn', fail: 'x' } as const;

export function CheckPanel({ report }: { report: AtsReport }) {
  const fails = report.checks.filter((c) => c.status !== 'pass').length;
  return (
    <div className="stack-lg">
      <div className="card pad score-card">
        <ScoreRing score={report.score} label="Resume score" />
        <div>
          <h3>{report.score >= 85 ? 'Ready to send' : report.score >= 65 ? 'Nearly there' : 'Needs work'}</h3>
          <p className="muted">
            {fails === 0 ? 'Every check passed.' : `${fails} thing${fails === 1 ? '' : 's'} to improve below.`} {report.stats.words} words · {report.stats.pages} page
            {report.stats.pages === 1 ? '' : 's'} · {report.stats.quantified}/{report.stats.bullets} bullets with numbers.
          </p>
          <p className="muted small">This check is free and runs in your browser. It follows what recruiters and ATS software actually reward: clear contact details, standard headings, action verbs and measurable results.</p>
        </div>
      </div>
      <ul className="checks">
        {report.checks.map((c) => (
          <li key={c.id} className={`check-item check-${c.status}`}>
            <span className="check-icon">
              <Icon name={STATUS_ICON[c.status]} size={15} />
            </span>
            <div>
              <strong>{c.label}</strong>
              <p>{c.detail}</p>
              {c.status !== 'pass' && c.examples?.length ? (
                <ul className="check-examples">
                  {c.examples.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
