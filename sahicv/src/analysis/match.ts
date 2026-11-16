import { ALIASES, CASE_SENSITIVE, SKILLS, SOFT_SKILLS, STOPWORDS } from './skills.ts';

// Job-description matcher. Runs entirely in the browser (no AI, no cost):
// 1. pull the important keywords out of the job description,
// 2. check which ones the resume already contains,
// 3. report a weighted match score with the missing keywords.

export interface Keyword {
  term: string;
  /** 'skill' = known skill or tool; 'term' = other phrase the JD stresses. */
  kind: 'skill' | 'term';
  weight: number;
  count: number;
}

export interface MatchResult {
  score: number;
  matched: Keyword[];
  missing: Keyword[];
  titleMatch: boolean | null;
  totalKeywords: number;
}

const SKILL_SET = new Set(SKILLS);

/** Reduces a word to a rough stem so "mentored", "mentoring" and "mentors" all match. */
export function stem(w: string): string {
  if (w.length <= 3 || /[^a-z]/.test(w)) return w;
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  if (s.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(s) && !/(ll|ss|ff|zz)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

const stemPhrase = (p: string) => p.split(' ').map(stem).join(' ');

/** Lower-cases and splits text into tokens, keeping things like c++, c#, .net, node.js, ci/cd. */
export function tokens(text: string): string[] {
  const lower = text.toLowerCase().replace(/[‐‑–—]/g, '-').replace(/[’‘]/g, "'");
  const raw = lower.match(/\.net\b|[a-z0-9][a-z0-9+#./&'-]*[a-z0-9+#]|[a-z0-9]/g) ?? [];
  return raw.map((t) => t.replace(/[.']+$/g, '').replace(/'s$/, '')).filter(Boolean);
}

// stemmed phrase -> canonical skill name
const SKILL_INDEX = new Map<string, string>();
for (const s of SKILLS) SKILL_INDEX.set(stemPhrase(s), s);
for (const [alias, skill] of Object.entries(ALIASES)) {
  if (SKILL_SET.has(skill) || skill === 'go') SKILL_INDEX.set(stemPhrase(alias), skill);
}
const AMBIGUOUS = new Set(Object.values(CASE_SENSITIVE).map(stemPhrase));
const MAX_PHRASE = Math.max(...[...SKILL_INDEX.keys()].map((s) => s.split(' ').length));

interface Index {
  skills: Map<string, number>;
  words: Map<string, number>;
  /** First surface form seen for each stemmed word. */
  surface: Map<string, string>;
  stems: string[];
  text: string;
}

/** Finds known skills (longest phrase first) and counts the remaining words. */
function index(text: string): Index {
  const toks = tokens(text);
  const stems = toks.map(stem);
  const skills = new Map<string, number>();
  const words = new Map<string, number>();
  const surface = new Map<string, string>();
  let i = 0;
  while (i < stems.length) {
    let hit: string | null = null;
    let len = 0;
    for (let n = Math.min(MAX_PHRASE, stems.length - i); n >= 1; n--) {
      const phrase = stems.slice(i, i + n).join(' ');
      // Single ambiguous words (go, r, c, word...) are handled by the case-sensitive pass.
      if (n === 1 && AMBIGUOUS.has(phrase)) continue;
      const s = SKILL_INDEX.get(phrase);
      if (s) {
        hit = s;
        len = n;
        break;
      }
    }
    if (hit) {
      skills.set(hit, (skills.get(hit) ?? 0) + 1);
      i += len;
    } else {
      words.set(stems[i], (words.get(stems[i]) ?? 0) + 1);
      if (!surface.has(stems[i])) surface.set(stems[i], toks[i]);
      i += 1;
    }
  }
  for (const [word, skill] of Object.entries(CASE_SENSITIVE)) {
    const re = new RegExp(`(^|[\\s,;:(/])${word}(?=[\\s,;:.)/]|$)`, 'g');
    const n = (text.match(re) ?? []).length;
    if (n) skills.set(skill, (skills.get(skill) ?? 0) + n);
  }
  return { skills, words, surface, stems, text: ' ' + stems.join(' ') + ' ' };
}

function looksLikeNoise(w: string): boolean {
  return w.length < 3 || STOPWORDS.has(w) || /^\d+([.,]\d+)?\+?$/.test(w) || /^[\d-]+$/.test(w);
}

/** Extracts the keywords a job description stresses, most important first. */
export function extractKeywords(jd: string, limit = 30): Keyword[] {
  const idx = index(jd);
  const skills: Keyword[] = [];
  for (const [term, count] of idx.skills) {
    const soft = SOFT_SKILLS.has(term);
    skills.push({ term, kind: 'skill', count, weight: (soft ? 1 : 2) + Math.min(count - 1, 3) * 0.5 });
  }
  skills.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  // Other stressed terms: repeated meaningful two-word phrases, then single words.
  const st = idx.stems;
  const toks = tokens(jd);
  const bigrams = new Map<string, { count: number; label: string }>();
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i];
    const b = st[i + 1];
    if (looksLikeNoise(toks[i]) || looksLikeNoise(toks[i + 1])) continue;
    if (SKILL_INDEX.has(a) || SKILL_INDEX.has(b) || SKILL_INDEX.has(`${a} ${b}`)) continue;
    const key = `${a} ${b}`;
    const cur = bigrams.get(key);
    if (cur) cur.count += 1;
    else bigrams.set(key, { count: 1, label: `${toks[i]} ${toks[i + 1]}` });
  }
  const used = new Set<string>();
  const terms: Keyword[] = [];
  const sortedBigrams = [...bigrams.entries()].filter(([, v]) => v.count >= 2).sort((x, y) => y[1].count - x[1].count);
  for (const [key, v] of sortedBigrams) {
    const [a, b] = key.split(' ');
    if (used.has(a) || used.has(b)) continue;
    used.add(a);
    used.add(b);
    terms.push({ term: v.label, kind: 'term', count: v.count, weight: 1 + Math.min(v.count - 2, 2) * 0.25 });
  }
  for (const [w, count] of idx.words) {
    const label = idx.surface.get(w) ?? w;
    if (count < 2 || looksLikeNoise(label) || looksLikeNoise(w) || used.has(w)) continue;
    terms.push({ term: label, kind: 'term', count, weight: 0.75 + Math.min(count - 2, 3) * 0.25 });
  }
  terms.sort((a, b) => b.weight - a.weight || b.count - a.count);
  const keptSkills = skills.slice(0, limit);
  return [...keptSkills, ...terms.slice(0, Math.max(6, limit - keptSkills.length))];
}

/** Scores how well resume text covers the keywords of a job description. */
export function matchResume(resumeText: string, jd: string, role = ''): MatchResult {
  const keywords = extractKeywords(jd);
  const idx = index(resumeText);
  const matched: Keyword[] = [];
  const missing: Keyword[] = [];
  let total = 0;
  let got = 0;
  for (const k of keywords) {
    total += k.weight;
    const has = k.kind === 'skill' ? idx.skills.has(k.term) : idx.text.includes(` ${stemPhrase(tokens(k.term).join(' '))} `);
    if (has) {
      got += k.weight;
      matched.push(k);
    } else {
      missing.push(k);
    }
  }
  let titleMatch: boolean | null = null;
  const skip = new Set(['senior', 'junior', 'lead', 'sr', 'jr', 'associate', 'the', 'and', 'of', 'i', 'ii', 'iii']);
  const roleWords = tokens(role).filter((w) => !skip.has(w)).map(stem);
  if (roleWords.length) {
    const hits = roleWords.filter((w) => idx.text.includes(` ${w} `)).length;
    titleMatch = hits / roleWords.length >= 0.6;
  }
  const score = total ? Math.round((got / total) * 100) : 0;
  return { score, matched, missing, titleMatch, totalKeywords: keywords.length };
}

export function scoreLabel(score: number): { label: string; tone: 'good' | 'ok' | 'low' } {
  if (score >= 75) return { label: 'Strong match', tone: 'good' };
  if (score >= 55) return { label: 'Fair match', tone: 'ok' };
  return { label: 'Low match', tone: 'low' };
}
