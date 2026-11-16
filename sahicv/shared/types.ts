// Data model shared by the browser app and the API worker.

export interface Link {
  label: string;
  url: string;
}

export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: Link[];
  summary: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: string;
  end: string;
  score: string;
}

export interface Project {
  id: string;
  name: string;
  link: string;
  tech: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface SkillGroup {
  id: string;
  name: string;
  /** Comma-separated list, kept as text so it is easy to edit. */
  items: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface CustomSection {
  id: string;
  title: string;
  bullets: string[];
}

export type TemplateId = 'classic' | 'modern' | 'crisp' | 'executive' | 'compact' | 'sidebar';
export type FontId = 'inter' | 'lato' | 'source-serif-4' | 'eb-garamond';
export type Spacing = 'compact' | 'normal' | 'relaxed';
export type PageSize = 'A4' | 'Letter';

export interface Design {
  template: TemplateId;
  accent: string;
  font: FontId;
  /** Body text size in points. */
  fontSize: number;
  spacing: Spacing;
  page: PageSize;
}

/** Built-in section keys. Custom sections use the key `custom:<id>`. */
export type BuiltinSection =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'achievements'
  | 'languages';

export interface Resume {
  id: string;
  /** Label for this version, e.g. "Base resume" or "Infosys – Data Analyst". */
  label: string;
  updatedAt: number;
  basics: Basics;
  experience: Experience[];
  education: Education[];
  projects: Project[];
  skills: SkillGroup[];
  certifications: Certification[];
  achievements: string[];
  languages: string;
  custom: CustomSection[];
  order: string[];
  design: Design;
}

export type JobStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface InterviewQuestion {
  category: string;
  question: string;
  why: string;
  howToAnswer: string;
  sampleAnswer: string;
}

export interface CompanyBrief {
  overview: string;
  whatTheyDo: string[];
  cultureAndValues: string[];
  talkingPoints: string[];
  questionsToAsk: string[];
  thingsToVerify: string[];
  source?: { title: string; url: string } | null;
}

export interface MockTurn {
  question: string;
  answer?: string;
  feedback?: MockFeedback;
}

export interface MockFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  betterAnswer: string;
}

export interface Job {
  id: string;
  company: string;
  role: string;
  jd: string;
  url: string;
  status: JobStatus;
  notes: string;
  createdAt: number;
  resumeId?: string;
  coverLetter?: string;
  questions?: InterviewQuestion[];
  brief?: CompanyBrief;
  mock?: MockTurn[];
}

// ---- AI task contracts -------------------------------------------------

export interface TailorChange {
  /** Where the change applies. */
  target: 'summary' | 'experience' | 'project' | 'skills';
  /** Id of the experience/project entry (when target needs one). */
  entryId?: string;
  /** Index of the bullet within the entry (when a bullet is rewritten). */
  bulletIndex?: number;
  before: string;
  after: string;
  reason: string;
  /** Set when the rewrite contains something the candidate should double-check. */
  warning?: string;
}

export interface TailorResult {
  changes: TailorChange[];
  /** JD keywords the resume lacks. Shown as "add only if true". */
  missingKeywords: string[];
  headline?: string;
  note?: string;
}

export interface KitResult {
  linkedinHeadline: string[];
  linkedinAbout: string;
  naukriHeadline: string[];
  referralMessage: string;
  coldEmail: { subject: string; body: string };
}

export type AiTask =
  | 'parse-resume'
  | 'summary'
  | 'improve-bullet'
  | 'tailor'
  | 'cover-letter'
  | 'interview-questions'
  | 'mock-question'
  | 'mock-feedback'
  | 'company-brief'
  | 'job-kit';
