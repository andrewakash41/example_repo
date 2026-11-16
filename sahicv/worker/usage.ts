import type { D1Like, Env } from './env.ts';
import { isMock } from './env.ts';
import { today } from './util.ts';

// Counts AI actions per day so free visitors get a small daily allowance and
// pass holders stay within fair use. Backed by Cloudflare D1 in production.

export interface UsageStore {
  get(key: string): Promise<number>;
  add(key: string): Promise<void>;
}

let schemaReady = false;

function d1Store(db: D1Like): UsageStore {
  const ready = async () => {
    if (schemaReady) return;
    await db
      .prepare('CREATE TABLE IF NOT EXISTS usage (k TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (k, day))')
      .run();
    schemaReady = true;
  };
  return {
    async get(key) {
      await ready();
      const row = await db.prepare('SELECT n FROM usage WHERE k = ? AND day = ?').bind(key, today()).first<{ n: number }>();
      return row?.n ?? 0;
    },
    async add(key) {
      await ready();
      await db
        .prepare('INSERT INTO usage (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1')
        .bind(key, today())
        .run();
    },
  };
}

const memory = new Map<string, number>();
const memoryStore: UsageStore = {
  async get(key) {
    return memory.get(`${key}|${today()}`) ?? 0;
  },
  async add(key) {
    const k = `${key}|${today()}`;
    memory.set(k, (memory.get(k) ?? 0) + 1);
  },
};

/** Returns the usage store, or null when none is configured (free AI is then switched off). */
export function usageStore(env: Env): UsageStore | null {
  if (env.DB) return d1Store(env.DB);
  if (isMock(env)) return memoryStore;
  return null;
}

export function resetMemoryUsage() {
  memory.clear();
}
