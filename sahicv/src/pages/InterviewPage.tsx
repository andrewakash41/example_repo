import { useEffect, useRef, useState } from 'react';
import type { CompanyBrief, InterviewQuestion, MockFeedback, MockTurn } from '../../shared/types.ts';
import { runAi } from '../api.ts';
import { JobBar, useJob } from '../components/jobs.tsx';
import { AiNote } from '../components/pass.tsx';
import { Button, CopyButton, Empty, Icon, TextArea } from '../components/ui.tsx';
import { useActiveResume, useApp } from '../store.ts';

type Tab = 'questions' | 'mock' | 'company';

// ---- Speech helpers (work in Chrome, Edge and Safari; hidden elsewhere) ----

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  u.rate = 0.98;
  window.speechSynthesis.speak(u);
}

function Questions() {
  const resume = useActiveResume();
  const job = useJob();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const questions = job.questions ?? [];
  const ready = job.jd.trim().length >= 40 || job.role.trim().length > 1;

  const generate = async () => {
    setBusy(true);
    const res = await runAi<{ questions: InterviewQuestion[] }>('interview-questions', { resume, jd: job.jd, role: job.role, company: job.company });
    setBusy(false);
    if (res?.questions.length && job.id) {
      useApp.getState().updateJob(job.id, { questions: res.questions });
      setOpen(0);
    }
  };

  const groups = new Map<string, { q: InterviewQuestion; i: number }[]>();
  questions.forEach((q, i) => {
    if (!groups.has(q.category)) groups.set(q.category, []);
    groups.get(q.category)!.push({ q, i });
  });

  return (
    <div className="stack">
      <div className="card pad ai-card">
        <div className="row row-between">
          <div>
            <h2>
              <Icon name="list" /> Questions you are likely to be asked
            </h2>
            <p className="muted">12 questions predicted from this job description and your resume, each with what the interviewer is checking and a sample answer built from your own experience.</p>
          </div>
          <Button variant="ai" size="lg" icon="spark" busy={busy} disabled={!ready} onClick={generate} data-testid="questions-btn">
            {questions.length ? 'Generate again' : 'Predict my questions'}
          </Button>
        </div>
        <AiNote />
      </div>
      {!questions.length ? (
        <Empty icon="list" title="No questions yet">
          {ready ? 'Click the button above to prepare for this role.' : 'Add the job title or paste the job description first.'}
        </Empty>
      ) : (
        [...groups.entries()].map(([cat, items]) => (
          <div key={cat} className="stack-sm">
            <h3 className="section-title">{cat}</h3>
            {items.map(({ q, i }) => (
              <div key={i} className={`qa${open === i ? ' qa-open' : ''}`}>
                <button className="qa-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span>{q.question}</span>
                  <span className="sec-chevron">
                    <Icon name="chevron" size={16} />
                  </span>
                </button>
                {open === i ? (
                  <div className="qa-body">
                    {q.why ? (
                      <p>
                        <strong>Why they ask:</strong> {q.why}
                      </p>
                    ) : null}
                    {q.howToAnswer ? (
                      <p>
                        <strong>How to answer:</strong> {q.howToAnswer}
                      </p>
                    ) : null}
                    {q.sampleAnswer ? (
                      <div className="sample">
                        <div className="row row-between">
                          <strong>Sample answer</strong>
                          <CopyButton text={q.sampleAnswer} />
                        </div>
                        <p>{q.sampleAnswer}</p>
                        <p className="muted small">Use this as a starting point and say it in your own words. Fill in anything shown in [brackets].</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function Mock() {
  const resume = useActiveResume();
  const job = useJob();
  const turns: MockTurn[] = job.mock ?? [];
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef('');
  const canListen = Boolean(recognitionCtor());
  const current = turns.length && !turns[turns.length - 1].feedback ? turns[turns.length - 1] : null;
  const done = turns.filter((t) => t.feedback);
  const avg = done.length ? Math.round((done.reduce((s, t) => s + (t.feedback?.score ?? 0), 0) / done.length) * 10) / 10 : 0;
  const ready = job.jd.trim().length >= 40 || job.role.trim().length > 1;
  const save = (next: MockTurn[]) => job.id && useApp.getState().updateJob(job.id, { mock: next });
  const common = { resume, jd: job.jd, role: job.role, company: job.company };

  useEffect(() => () => recRef.current?.stop(), []);

  const start = async () => {
    setBusy(true);
    const res = await runAi<{ question: string }>('mock-question', { ...common, asked: [] });
    setBusy(false);
    if (res?.question) {
      save([{ question: res.question }]);
      if (voice) speak(res.question);
    }
  };

  const submit = async () => {
    if (!current) return;
    recRef.current?.stop();
    setBusy(true);
    const res = await runAi<{ feedback: MockFeedback; nextQuestion: string }>('mock-feedback', {
      ...common,
      question: current.question,
      answer,
      asked: turns.map((t) => t.question),
    });
    setBusy(false);
    if (!res) return;
    const next: MockTurn[] = [...turns.slice(0, -1), { question: current.question, answer, feedback: res.feedback }];
    if (res.nextQuestion && next.length < 8) next.push({ question: res.nextQuestion });
    save(next);
    setAnswer('');
    if (voice && res.nextQuestion && next.length <= 8) speak(res.nextQuestion);
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = answer ? answer.trimEnd() + ' ' : '';
    rec.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setAnswer(baseRef.current + finalText + interim);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="stack">
      <div className="card pad ai-card">
        <div className="row row-between">
          <div>
            <h2>
              <Icon name="mic" /> Mock interview
            </h2>
            <p className="muted">Answer one question at a time by typing or speaking. You get a score, what worked, what to fix and a stronger version of your own answer. Each answer uses 1 AI action.</p>
          </div>
          <div className="row">
            {'speechSynthesis' in window ? (
              <label className="check">
                <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Read questions aloud
              </label>
            ) : null}
            {turns.length ? (
              <Button
                icon="refresh"
                onClick={() => {
                  save([]);
                  setAnswer('');
                }}
              >
                Start over
              </Button>
            ) : (
              <Button variant="ai" size="lg" icon="play" busy={busy} disabled={!ready} onClick={start} data-testid="mock-start">
                Start interview
              </Button>
            )}
          </div>
        </div>
        <AiNote />
      </div>

      {!turns.length ? (
        <Empty icon="mic" title="Practise before the real thing">
          {ready ? 'Up to 8 questions, mixed between behavioural, role-specific and resume-based.' : 'Add the job title or paste the job description first.'}
        </Empty>
      ) : null}

      {done.length ? (
        <div className="mock-summary">
          <span>
            Answered <strong>{done.length}</strong>
          </span>
          <span>
            Average score <strong>{avg}/10</strong>
          </span>
        </div>
      ) : null}

      {done.map((t, i) => (
        <div key={i} className="card pad turn">
          <div className="turn-q">
            <span className="turn-n">Q{i + 1}</span> {t.question}
          </div>
          <p className="turn-a">{t.answer}</p>
          {t.feedback ? (
            <div className="feedback">
              <div className={`score-badge score-${t.feedback.score >= 7 ? 'good' : t.feedback.score >= 5 ? 'ok' : 'low'}`}>{t.feedback.score}/10</div>
              <div className="feedback-cols">
                {t.feedback.strengths.length ? (
                  <div>
                    <h4>What worked</h4>
                    <ul>
                      {t.feedback.strengths.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <h4>Improve</h4>
                  <ul>
                    {t.feedback.improvements.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {t.feedback.betterAnswer ? (
                <div className="sample">
                  <div className="row row-between">
                    <strong>A stronger version of your answer</strong>
                    <CopyButton text={t.feedback.betterAnswer} />
                  </div>
                  <p>{t.feedback.betterAnswer}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}

      {current ? (
        <div className="card pad turn turn-live">
          <div className="turn-q">
            <span className="turn-n">Q{done.length + 1}</span> {current.question}
            {'speechSynthesis' in window ? (
              <button className="icon-btn" aria-label="Read the question aloud" title="Read aloud" onClick={() => speak(current.question)}>
                <Icon name="volume" size={16} />
              </button>
            ) : null}
          </div>
          <TextArea value={answer} onChange={setAnswer} minRows={5} placeholder="Type your answer as you would say it…" aria-label="Your answer" />
          <div className="row row-between">
            <div className="row">
              {canListen ? (
                <Button icon="mic" variant={listening ? 'danger' : 'secondary'} onClick={toggleMic}>
                  {listening ? 'Stop recording' : 'Speak answer'}
                </Button>
              ) : null}
              <span className="muted small">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words · aim for 80–160</span>
            </div>
            <Button variant="ai" icon="spark" busy={busy} disabled={answer.trim().length < 2} onClick={submit} data-testid="mock-submit">
              Get feedback
            </Button>
          </div>
        </div>
      ) : null}

      {turns.length && !current ? (
        <div className="notice notice-ok">
          <Icon name="check" /> Interview complete. Your average was {avg}/10. Review the stronger answers above, then start over to practise again.
        </div>
      ) : null}
    </div>
  );
}

function Company() {
  const job = useJob();
  const [busy, setBusy] = useState(false);
  const brief: CompanyBrief | undefined = job.brief;
  const generate = async () => {
    setBusy(true);
    const res = await runAi<{ brief: CompanyBrief }>('company-brief', { company: job.company, role: job.role, jd: job.jd });
    setBusy(false);
    if (res?.brief && job.id) useApp.getState().updateJob(job.id, { brief: res.brief });
  };
  const block = (title: string, items: string[]) =>
    items.length ? (
      <div className="card pad">
        <h3>{title}</h3>
        <ul className="plain-list">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="stack">
      <div className="card pad ai-card">
        <div className="row row-between">
          <div>
            <h2>
              <Icon name="building" /> Company briefing
            </h2>
            <p className="muted">What the company does, what it seems to value, what to say when asked "why us?" and good questions to ask them. Facts are drawn from Wikipedia and the job post where available.</p>
          </div>
          <Button variant="ai" size="lg" icon="spark" busy={busy} disabled={job.company.trim().length < 2} onClick={generate} data-testid="brief-btn">
            {brief ? 'Refresh briefing' : 'Brief me'}
          </Button>
        </div>
        <AiNote />
      </div>
      {!brief ? (
        <Empty icon="building" title={job.company.trim() ? `No briefing for ${job.company} yet` : 'Enter the company name first'}>
          {job.company.trim() ? 'Click the button above.' : 'Add it in the job details at the top of this page.'}
        </Empty>
      ) : (
        <>
          <div className="card pad">
            <h3>{job.company}</h3>
            <p>{brief.overview}</p>
            {brief.source ? (
              <p className="muted small">
                Source:{' '}
                <a href={brief.source.url} target="_blank" rel="noreferrer">
                  Wikipedia: {brief.source.title}
                </a>
              </p>
            ) : (
              <p className="muted small">No public reference page was found for this company, so this briefing relies on the job description and general knowledge.</p>
            )}
          </div>
          <div className="grid-cards">
            {block('What they do', brief.whatTheyDo)}
            {block('What they value', brief.cultureAndValues)}
            {block('"Why this company?" talking points', brief.talkingPoints)}
            {block('Questions to ask them', brief.questionsToAsk)}
          </div>
          {brief.thingsToVerify.length ? (
            <div className="notice notice-warn">
              <div>
                <strong>Check these before the interview.</strong> AI can be out of date or wrong about companies. Confirm on their website, LinkedIn page and recent news:
                <ul className="plain-list">
                  {brief.thingsToVerify.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function InterviewPage() {
  const [tab, setTab] = useState<Tab>('questions');
  return (
    <div className="page">
      <header className="page-head">
        <h1>Interview coach</h1>
        <p>Prepare for a specific job: the questions to expect, a practice interview with honest feedback, and a briefing on the company.</p>
      </header>
      <JobBar collapsible />
      <div className="tabs" role="tablist">
        {(
          [
            ['questions', 'Likely questions', 'list'],
            ['mock', 'Mock interview', 'mic'],
            ['company', 'Company briefing', 'building'],
          ] as const
        ).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'questions' ? <Questions /> : null}
      {tab === 'mock' ? <Mock /> : null}
      {tab === 'company' ? <Company /> : null}
    </div>
  );
}
