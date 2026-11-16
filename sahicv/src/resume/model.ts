import type { Design, Resume } from '../../shared/types.ts';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const DEFAULT_ORDER = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'certifications',
  'achievements',
  'languages',
];

export const FRESHER_ORDER = [
  'summary',
  'education',
  'skills',
  'projects',
  'experience',
  'certifications',
  'achievements',
  'languages',
];

export const DEFAULT_DESIGN: Design = {
  template: 'modern',
  accent: '#1d4ed8',
  font: 'inter',
  fontSize: 10,
  spacing: 'normal',
  page: 'A4',
};

export function emptyResume(label = 'My resume'): Resume {
  return {
    id: uid(),
    label,
    updatedAt: Date.now(),
    basics: { name: '', headline: '', email: '', phone: '', location: '', links: [], summary: '' },
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
    languages: '',
    custom: [],
    order: [...DEFAULT_ORDER],
    design: { ...DEFAULT_DESIGN },
  };
}

/** A realistic, fictional profile used for the demo and the template gallery. */
export function sampleResume(): Resume {
  return {
    id: uid(),
    label: 'Sample resume',
    updatedAt: Date.now(),
    basics: {
      name: 'Ananya Iyer',
      headline: 'Senior Software Engineer · Backend & Payments',
      email: 'ananya.iyer@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, Karnataka',
      links: [
        { label: 'LinkedIn', url: 'linkedin.com/in/ananya-iyer' },
        { label: 'GitHub', url: 'github.com/ananyaiyer' },
      ],
      summary:
        'Backend engineer with 6 years building high-volume payment and order systems in Java and Go. Led a monolith-to-microservices migration handling 2M+ transactions a day and cut checkout latency by 38%.',
    },
    experience: [
      {
        id: uid(),
        title: 'Senior Software Engineer',
        company: 'Kaveri Payments',
        location: 'Bengaluru',
        start: 'Jul 2022',
        end: '',
        current: true,
        bullets: [
          'Led a team of 5 to split the payments monolith into 9 event-driven services on Kafka, raising deployment frequency from weekly to daily.',
          'Cut p95 checkout latency from 820 ms to 510 ms (38%) by adding a Redis read-through cache.',
          'Built a reconciliation pipeline for 2M+ daily transactions, saving the finance team 30 hours a week.',
          'Mentored 4 junior engineers; two were promoted within 18 months.',
        ],
      },
      {
        id: uid(),
        title: 'Software Engineer',
        company: 'Trellis Commerce',
        location: 'Chennai',
        start: 'Jun 2019',
        end: 'Jun 2022',
        current: false,
        bullets: [
          'Built order REST APIs in Spring Boot serving 40K requests a minute at 99.95% uptime.',
          'Saved ₹18 lakh a year in cloud spend by right-sizing Kubernetes workloads and using spot instances.',
          'Introduced contract testing with Pact, cutting integration defects found in UAT by 45%.',
        ],
      },
    ],
    education: [
      {
        id: uid(),
        degree: 'B.E. Computer Science and Engineering',
        school: 'Anna University',
        location: 'Chennai',
        start: '2015',
        end: '2019',
        score: 'CGPA 8.7/10',
      },
    ],
    projects: [
      {
        id: uid(),
        name: 'LedgerLite',
        link: 'github.com/ananyaiyer/ledgerlite',
        tech: 'Go, PostgreSQL, gRPC',
        start: '2023',
        end: '',
        bullets: [
          'Open-source double-entry ledger library with 600+ GitHub stars, used by 3 fintechs in production.',
          'Designed an append-only schema that keeps balance queries under 5 ms at 50M rows.',
        ],
      },
    ],
    skills: [
      { id: uid(), name: 'Languages', items: 'Java, Go, SQL, Python' },
      { id: uid(), name: 'Backend', items: 'Spring Boot, gRPC, Kafka, Redis, PostgreSQL, REST APIs, Microservices' },
      { id: uid(), name: 'Cloud & DevOps', items: 'AWS, Kubernetes, Docker, Terraform, CI/CD, Grafana' },
    ],
    certifications: [{ id: uid(), name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', date: '2023' }],
    achievements: [
      'Winner, Kaveri Payments hackathon 2023; the fraud-scoring prototype later shipped to production.',
      'Speaker at GopherCon India 2024 on idempotency in payment systems.',
    ],
    languages: 'English (fluent), Tamil (native), Hindi (conversational)',
    custom: [],
    order: [...DEFAULT_ORDER],
    design: { ...DEFAULT_DESIGN },
  };
}

/** Repairs a resume loaded from storage or a JSON backup so the UI never crashes on it. */
export function normalizeResume(input: unknown): Resume {
  const base = emptyResume();
  const r = (input && typeof input === 'object' ? input : {}) as Partial<Resume>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const strArr = (v: unknown) => arr<unknown>(v).map(str);
  const b = (r.basics ?? {}) as Partial<Resume['basics']>;
  return {
    id: str(r.id) || base.id,
    label: str(r.label) || 'My resume',
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
    basics: {
      name: str(b.name),
      headline: str(b.headline),
      email: str(b.email),
      phone: str(b.phone),
      location: str(b.location),
      links: arr<{ label?: string; url?: string }>(b.links).map((l) => ({ label: str(l?.label), url: str(l?.url) })),
      summary: str(b.summary),
    },
    experience: arr<Record<string, unknown>>(r.experience).map((e) => ({
      id: str(e.id) || uid(),
      title: str(e.title),
      company: str(e.company),
      location: str(e.location),
      start: str(e.start),
      end: str(e.end),
      current: Boolean(e.current),
      bullets: strArr(e.bullets),
    })),
    education: arr<Record<string, unknown>>(r.education).map((e) => ({
      id: str(e.id) || uid(),
      degree: str(e.degree),
      school: str(e.school),
      location: str(e.location),
      start: str(e.start),
      end: str(e.end),
      score: str(e.score),
    })),
    projects: arr<Record<string, unknown>>(r.projects).map((p) => ({
      id: str(p.id) || uid(),
      name: str(p.name),
      link: str(p.link),
      tech: str(p.tech),
      start: str(p.start),
      end: str(p.end),
      bullets: strArr(p.bullets),
    })),
    skills: arr<Record<string, unknown>>(r.skills).map((s) => ({
      id: str(s.id) || uid(),
      name: str(s.name),
      items: Array.isArray(s.items) ? strArr(s.items).join(', ') : str(s.items),
    })),
    certifications: arr<Record<string, unknown>>(r.certifications).map((c) => ({
      id: str(c.id) || uid(),
      name: str(c.name),
      issuer: str(c.issuer),
      date: str(c.date),
    })),
    achievements: strArr(r.achievements),
    languages: Array.isArray(r.languages) ? strArr(r.languages).join(', ') : str(r.languages),
    custom: arr<Record<string, unknown>>(r.custom).map((c) => ({
      id: str(c.id) || uid(),
      title: str(c.title),
      bullets: strArr(c.bullets),
    })),
    order: strArr(r.order).length ? strArr(r.order) : [...DEFAULT_ORDER],
    design: { ...DEFAULT_DESIGN, ...(typeof r.design === 'object' && r.design ? r.design : {}) },
  };
}

export function cloneResume(r: Resume, label: string): Resume {
  const copy = JSON.parse(JSON.stringify(r)) as Resume;
  copy.id = uid();
  copy.label = label;
  copy.updatedAt = Date.now();
  return copy;
}
