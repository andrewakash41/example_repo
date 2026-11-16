import { useState } from 'react';
import { BRAND, PLANS } from '../../shared/plans.ts';
import { PlanCards } from '../components/pass.tsx';
import { Icon, Logo } from '../components/ui.tsx';
import { TEMPLATES } from '../resume/templates.ts';
import { Link } from '../router.tsx';

const lowest = Math.round(Math.min(...PLANS.map((p) => p.inr)) / 100);

const FREE = [
  ['file', 'Resume builder', 'Six clean templates, live preview, unlimited versions. No sign-up.'],
  ['download', 'Every download format', 'PDF, Word, plain text and Markdown. No watermark, no paywall, ever.'],
  ['shield', 'Resume check', '16 checks recruiters and ATS software care about, with the exact lines to fix.'],
  ['target', 'Job match score', 'Paste a job description and see which keywords you have and which you are missing.'],
  ['briefcase', 'Application tracker', 'Keep each job with its tailored resume, cover letter and interview prep.'],
] as const;

const AI = [
  ['spark', 'Tailor to the job', 'Rewrites your summary and bullets in the job’s language. You approve every change.'],
  ['edit', 'Better bullets', 'Turn "responsible for…" into what you did and what it achieved, in one click.'],
  ['mail', 'Cover letters', 'Built from your real achievements for the specific role, in the tone you choose.'],
  ['list', 'Likely questions', '12 questions predicted for the role, with sample answers from your own experience.'],
  ['mic', 'Mock interview', 'Type or speak your answers and get a score, fixes and a stronger version.'],
  ['building', 'Company briefing', 'What they do, what to say for "why us?" and smart questions to ask.'],
  ['kit', 'Job-search kit', 'LinkedIn headline and About, Naukri headline, referral message and cold email.'],
] as const;

const COMPARE: [string, string, string][] = [
  ['Download your resume as PDF', 'Free, always', 'Often locked behind payment after you finish'],
  ['Pricing', `One-time pass from ₹${lowest}`, 'Trial that renews monthly, often around ₹2,000+'],
  ['Cancelling', 'Nothing to cancel', 'You must remember to cancel'],
  ['Sign-up', 'Not needed', 'Email and password first'],
  ['Where your resume is stored', 'In your own browser', 'On their servers'],
  ['PDF that ATS software can read', 'Real text, single column', 'Varies; some export images'],
  ['AI rewrites', 'Shown as before/after for approval; never adds skills you do not have', 'Often applied automatically'],
];

const FAQ: [string, string][] = [
  ['Is downloading really free?', 'Yes. Building, editing, checking and downloading your resume in every format is free and stays free. You only pay if you want the AI features, and that is a one-time pass, not a subscription.'],
  ['What does the AI pass include?', 'Unlimited use (within a generous fair-use limit) of resume tailoring, bullet and summary rewriting, cover letters, interview questions, mock interviews, company briefings and the job-search kit for 7, 30 or 90 days. You also get a few free AI actions every day without paying.'],
  ['Will it renew automatically?', 'No. A pass is a single payment by UPI, card or netbanking. When it ends, it simply ends. There is nothing to cancel and no card kept on file.'],
  ['What does "ATS-friendly" mean?', 'Most companies and job portals pass resumes through applicant tracking software before a person reads them. That software copes best with a single column, standard section headings and real text. Our PDFs are built that way, and the resume check tells you what else to fix.'],
  ['Does the AI invent experience or skills?', 'It is instructed never to add employers, skills or numbers that are not in your resume, and every suggestion is shown as a before-and-after for you to accept or reject. Keywords you are missing are listed separately so that you add only the ones that are true. Always read the result before you send it; AI can still make mistakes.'],
  ['Where is my data stored?', 'In your own browser, on your device. We have no accounts and keep no copy of your resume. When you use an AI feature, the text needed for that request is sent to our AI provider to generate the answer. See the privacy policy for details.'],
  ['Can I use it on my phone?', 'Yes. The builder, downloads and AI tools all work in a mobile browser. Because your data lives in the browser, use the Backup download to move a resume to another device.'],
  ['What if I am not happy with the pass?', 'Write to us within 3 days of buying and we will refund it. See the refund policy.'],
];

export default function Landing() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="landing">
      <header className="lnav">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main">
          <Link href="/#features">Features</Link>
          <Link href="/#templates">Templates</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        <Link href="/app/resume" className="btn btn-primary btn-md">
          <span>Build my resume</span>
        </Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Free resume builder · AI job-search tools</span>
          <h1>The resume builder that never charges you to download your own resume.</h1>
          <p className="lead">
            Build an ATS-friendly resume, match it to any job description and practise the interview. Downloads are free forever. AI help is a one-time pass from ₹{lowest}: no
            subscription, nothing to cancel.
          </p>
          <div className="hero-cta">
            <Link href="/app/resume" className="btn btn-primary btn-lg">
              <span>Build my resume, free</span>
              <Icon name="right" size={18} />
            </Link>
            <Link href="/#pricing" className="btn btn-secondary btn-lg">
              <span>See pricing</span>
            </Link>
          </div>
          <ul className="hero-points">
            <li>
              <Icon name="check" size={16} /> No sign-up
            </li>
            <li>
              <Icon name="check" size={16} /> Your data stays in your browser
            </li>
            <li>
              <Icon name="check" size={16} /> Pay by UPI, once
            </li>
          </ul>
        </div>
        <div className="hero-art" aria-hidden="true">
          <img className="hero-doc hero-doc-back" src="/img/tpl-classic.png" alt="" />
          <img className="hero-doc hero-doc-front" src="/img/hero-modern.png" alt="" />
          <div className="hero-badge hero-badge-score">
            <strong>92</strong>
            <span>Resume score</span>
          </div>
          <div className="hero-badge hero-badge-match">
            <Icon name="target" size={16} /> 78% match to the job
          </div>
        </div>
      </section>

      <section className="steps">
        {[
          ['1', 'Build or import', 'Start from your existing resume or a blank page. See the final PDF as you type.'],
          ['2', 'Match it to the job', 'Paste the job description to see your match score, then tailor the wording.'],
          ['3', 'Prepare and apply', 'Get a cover letter, the questions to expect and a practice interview.'],
        ].map(([n, t, d]) => (
          <div key={n} className="step">
            <span className="step-n">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section className="band" id="features">
        <div className="wrap">
          <h2>Everything you need from first draft to final interview</h2>
          <div className="feat-cols">
            <div>
              <h3 className="feat-head">
                <span className="tag tag-free">Free forever</span>
              </h3>
              <ul className="feats">
                {FREE.map(([icon, title, text]) => (
                  <li key={title}>
                    <span className="feat-icon">
                      <Icon name={icon} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="feat-head">
                <span className="tag tag-ai">With an AI pass</span>
                <small>a few free tries every day</small>
              </h3>
              <ul className="feats">
                {AI.map(([icon, title, text]) => (
                  <li key={title}>
                    <span className="feat-icon feat-icon-ai">
                      <Icon name={icon} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2>Built to fix what people dislike about resume builders</h2>
        <p className="section-lead">The most common complaint about resume sites is finishing a resume and then being asked to pay to download it, followed by a trial that quietly renews. We do neither.</p>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{BRAND.name}</th>
                <th scope="col">Many resume builders</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([a, b, c]) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  <td className="yes">
                    <Icon name="check" size={15} /> {b}
                  </td>
                  <td>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" id="templates">
        <div className="wrap">
          <h2>Six templates recruiters can actually read</h2>
          <p className="section-lead">Change colour, font, spacing and section order at any time. Five are single-column and ATS-safe; one is a two-column design for sending directly to people.</p>
          <div className="gallery">
            {TEMPLATES.map((t) => (
              <Link key={t.id} href="/app/resume" className="gallery-item">
                <img src={`/img/tpl-${t.id}.png`} alt={`${t.name} resume template`} loading="lazy" />
                <span>
                  <strong>{t.name}</strong>
                  {t.atsSafe ? <em className="badge badge-ok">ATS-safe</em> : <em className="badge badge-warn">2-column</em>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section" id="pricing">
        <h2>Simple, honest pricing</h2>
        <p className="section-lead">The resume builder and every download are free. Pay only if you want unlimited AI, and only once.</p>
        <PlanCards />
      </section>

      <section className="band" id="faq">
        <div className="wrap wrap-narrow">
          <h2>Questions</h2>
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <div key={q} className={`qa${open === i ? ' qa-open' : ''}`}>
                <button className="qa-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span>{q}</span>
                  <span className="sec-chevron">
                    <Icon name="chevron" size={16} />
                  </span>
                </button>
                {open === i ? (
                  <div className="qa-body">
                    <p>{a}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Your next interview starts with a better resume.</h2>
        <Link href="/app/resume" className="btn btn-primary btn-lg">
          <span>Build my resume, free</span>
          <Icon name="right" size={18} />
        </Link>
      </section>

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <div>
          <Logo />
          <p className="muted small">{BRAND.tagline}.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/app/resume">Resume builder</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
      <p className="muted small center">
        © {new Date().getFullYear()} {BRAND.legalName}. Made in India.
      </p>
    </footer>
  );
}
