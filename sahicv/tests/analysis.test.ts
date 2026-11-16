import { describe, expect, it } from 'vitest';
import { checkResume } from '../src/analysis/ats.ts';
import { extractKeywords, matchResume, stem } from '../src/analysis/match.ts';
import { emptyResume, sampleResume } from '../src/resume/model.ts';
import { resumeToText } from '../src/resume/text.ts';

const JD = `Senior Backend Engineer - Payments. Strong Java and Go experience building high-volume payment systems.
Design microservices on Kafka, own PostgreSQL schemas, work with Kubernetes and AWS, and mentor junior engineers.
Experience with Redis, gRPC, REST APIs and CI/CD is required. Knowledge of Prometheus and PCI DSS compliance is a plus.`;

describe('resume check', () => {
  it('scores a strong resume highly', () => {
    const report = checkResume(sampleResume(), 1);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.checks.length).toBeGreaterThanOrEqual(12);
  });

  it('scores an empty resume low and says what is missing', () => {
    const report = checkResume(emptyResume(), 1);
    expect(report.score).toBeLessThan(40);
    expect(report.checks.some((c) => c.status === 'fail')).toBe(true);
  });

  it('flags weak, unquantified bullets with the offending lines', () => {
    const r = sampleResume();
    r.experience[0].bullets = ['Responsible for the backend.', 'Worked on various tasks.', 'Helped the team.'];
    r.experience[1].bullets = ['Responsible for APIs.'];
    const strong = checkResume(sampleResume(), 1);
    const weak = checkResume(r, 1);
    expect(weak.score).toBeLessThan(strong.score);
    const flagged = weak.checks.filter((c) => c.status !== 'pass');
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.some((c) => c.examples?.some((e) => e.includes('Responsible for')))).toBe(true);
  });

  it('penalises a resume that runs to three pages', () => {
    expect(checkResume(sampleResume(), 3).score).toBeLessThan(checkResume(sampleResume(), 1).score);
  });
});

describe('job match', () => {
  it('finds matched and missing keywords', () => {
    const m = matchResume(resumeToText(sampleResume()), JD, 'Senior Backend Engineer');
    const matched = m.matched.map((k) => k.term);
    const missing = m.missing.map((k) => k.term);
    for (const k of ['java', 'kafka', 'postgresql', 'kubernetes', 'redis']) expect(matched).toContain(k);
    expect(missing).toContain('prometheus');
    expect(matched).not.toContain('prometheus');
    expect(m.score).toBeGreaterThan(55);
    expect(m.score).toBeLessThanOrEqual(100);
  });

  it('scores an unrelated resume much lower', () => {
    const r = emptyResume();
    r.basics.summary = 'Primary school teacher with ten years of classroom experience in English and social studies.';
    const good = matchResume(resumeToText(sampleResume()), JD).score;
    const bad = matchResume(resumeToText(r), JD).score;
    expect(bad).toBeLessThan(25);
    expect(good - bad).toBeGreaterThan(40);
  });

  it('treats word forms as the same keyword', () => {
    expect(stem('mentoring')).toBe(stem('mentored'));
    const m = matchResume('I mentored four engineers.', 'You will be mentoring junior engineers and must know Java.');
    expect(m.matched.map((k) => k.term).join(' ')).toMatch(/mentor/);
  });

  it('does not count a multi-word skill twice', () => {
    const terms = extractKeywords('We need Spring Boot and REST APIs experience with Spring Boot services.').map((k) => k.term);
    expect(terms).toContain('spring boot');
    expect(terms).not.toContain('spring');
  });

  it('returns nothing for an empty job description', () => {
    expect(matchResume('anything', '').totalKeywords).toBe(0);
  });
});
