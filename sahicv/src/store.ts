import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Job, Resume } from '../shared/types.ts';
import { cloneResume, emptyResume, normalizeResume, sampleResume, uid } from './resume/model.ts';

// Everything the visitor creates is kept in their own browser (localStorage).
// There are no accounts and nothing is uploaded except the text sent to an AI
// feature at the moment they use it.

export interface PassInfo {
  plan: string;
  exp: number;
}

interface AppState {
  resumes: Resume[];
  activeResumeId: string;
  jobs: Job[];
  activeJobId: string | null;
  passToken: string | null;
  pass: PassInfo | null;

  updateResume(mutate: (r: Resume) => void): void;
  replaceResume(r: Resume): void;
  addResume(r: Resume): void;
  duplicateResume(label: string): string;
  deleteResume(id: string): void;
  setActiveResume(id: string): void;

  addJob(partial?: Partial<Job>): string;
  updateJob(id: string, patch: Partial<Job>): void;
  deleteJob(id: string): void;
  setActiveJob(id: string | null): void;

  setPass(token: string, pass: PassInfo): void;
  clearPass(): void;
}

const first = sampleResume();

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      resumes: [first],
      activeResumeId: first.id,
      jobs: [],
      activeJobId: null,
      passToken: null,
      pass: null,

      updateResume(mutate) {
        set((s) => ({
          resumes: s.resumes.map((r) => {
            if (r.id !== s.activeResumeId) return r;
            const copy = structuredClone(r);
            mutate(copy);
            copy.updatedAt = Date.now();
            return copy;
          }),
        }));
      },
      replaceResume(r) {
        set((s) => ({ resumes: s.resumes.map((x) => (x.id === r.id ? { ...r, updatedAt: Date.now() } : x)) }));
      },
      addResume(r) {
        set((s) => ({ resumes: [...s.resumes, r], activeResumeId: r.id }));
      },
      duplicateResume(label) {
        const cur = get().resumes.find((r) => r.id === get().activeResumeId) ?? get().resumes[0];
        const copy = cloneResume(cur, label);
        set((s) => ({ resumes: [...s.resumes, copy], activeResumeId: copy.id }));
        return copy.id;
      },
      deleteResume(id) {
        set((s) => {
          let resumes = s.resumes.filter((r) => r.id !== id);
          if (!resumes.length) resumes = [emptyResume()];
          const activeResumeId = s.activeResumeId === id ? resumes[0].id : s.activeResumeId;
          return { resumes, activeResumeId };
        });
      },
      setActiveResume(id) {
        set({ activeResumeId: id });
      },

      addJob(partial) {
        const job: Job = {
          id: uid(),
          company: '',
          role: '',
          jd: '',
          url: '',
          status: 'saved',
          notes: '',
          createdAt: Date.now(),
          ...partial,
        };
        set((s) => ({ jobs: [job, ...s.jobs], activeJobId: job.id }));
        return job.id;
      },
      updateJob(id, patch) {
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
      },
      deleteJob(id) {
        set((s) => {
          const jobs = s.jobs.filter((j) => j.id !== id);
          return { jobs, activeJobId: s.activeJobId === id ? (jobs[0]?.id ?? null) : s.activeJobId };
        });
      },
      setActiveJob(id) {
        set({ activeJobId: id });
      },

      setPass(token, pass) {
        set({ passToken: token, pass });
      },
      clearPass() {
        set({ passToken: null, pass: null });
      },
    }),
    {
      name: 'sahicv:v1',
      version: 1,
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<AppState>;
        const resumes = Array.isArray(s.resumes) && s.resumes.length ? s.resumes.map(normalizeResume) : current.resumes;
        const activeResumeId = resumes.some((r) => r.id === s.activeResumeId) ? (s.activeResumeId as string) : resumes[0].id;
        const jobs = Array.isArray(s.jobs) ? s.jobs : [];
        const pass = s.pass && s.pass.exp * 1000 > Date.now() ? s.pass : null;
        return {
          ...current,
          resumes,
          activeResumeId,
          jobs,
          activeJobId: jobs.some((j) => j.id === s.activeJobId) ? (s.activeJobId as string) : (jobs[0]?.id ?? null),
          pass,
          passToken: pass ? (s.passToken ?? null) : null,
        };
      },
    },
  ),
);

export function useActiveResume(): Resume {
  return useApp((s) => s.resumes.find((r) => r.id === s.activeResumeId) ?? s.resumes[0]);
}

export function useActiveJob(): Job | null {
  return useApp((s) => s.jobs.find((j) => j.id === s.activeJobId) ?? null);
}

// ---- Transient UI state (not saved) -------------------------------------

export interface SiteConfig {
  payments: 'razorpay' | 'mock' | 'off';
  usd: boolean;
  ai: boolean;
  demo: boolean;
  free: { perDay: number; used: number };
  pass: PassInfo | null;
}

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface UiState {
  config: SiteConfig | null;
  paywall: null | { reason: string };
  toasts: Toast[];
  /** Results worth keeping while the visitor moves between tabs (not saved to disk). */
  cache: Record<string, unknown>;
  setCache(key: string, value: unknown): void;
  setConfig(c: SiteConfig): void;
  setFreeUsed(n: number): void;
  openPaywall(reason?: string): void;
  closePaywall(): void;
  toast(text: string, tone?: 'ok' | 'error'): void;
  dismissToast(id: number): void;
}

let toastSeq = 1;

export const useUi = create<UiState>()((set) => ({
  config: null,
  paywall: null,
  toasts: [],
  cache: {},
  setCache(key, value) {
    set((s) => ({ cache: { ...s.cache, [key]: value } }));
  },
  setConfig(c) {
    set({ config: c });
  },
  setFreeUsed(n) {
    set((s) => (s.config ? { config: { ...s.config, free: { ...s.config.free, used: n } } } : {}));
  },
  openPaywall(reason = '') {
    set({ paywall: { reason } });
  },
  closePaywall() {
    set({ paywall: null });
  },
  toast(text, tone = 'ok') {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 6000 : 3200);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Whether the visitor currently holds a valid pass. */
export function hasPass(): boolean {
  const p = useApp.getState().pass;
  return Boolean(p && p.exp * 1000 > Date.now());
}
