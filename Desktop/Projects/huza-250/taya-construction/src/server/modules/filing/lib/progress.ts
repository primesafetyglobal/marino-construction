// LIVE PROGRESS of running jobs, in process memory (guide §4.6). Gone after a
// restart; every job is resumable from database state.

export type Progress = {
  jobId: string;
  type: string;
  phase: string;
  done: number;
  total: number;
  failed: number;
  bytes: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  reportName: string | null;
};

const store = new Map<string, Progress>();

export const progress = {
  start(jobId: string, type: string, phase = "RUNNING", total = 0): Progress {
    const p: Progress = { jobId, type, phase, done: 0, total, failed: 0, bytes: 0, message: null, startedAt: new Date().toISOString(), finishedAt: null, error: null, reportName: null };
    store.set(jobId, p);
    trim();
    return p;
  },
  set(jobId: string, patch: Partial<Progress>) {
    const p = store.get(jobId);
    if (p) Object.assign(p, patch);
  },
  inc(jobId: string, field: "done" | "failed" | "bytes", by = 1) {
    const p = store.get(jobId);
    if (p) p[field] += by;
  },
  finish(jobId: string, patch: Partial<Progress> = {}) {
    const p = store.get(jobId);
    if (p) Object.assign(p, { phase: "DONE", finishedAt: new Date().toISOString() }, patch);
  },
  get: (jobId: string) => store.get(jobId) ?? null,
  latest(): Progress | null {
    let last: Progress | null = null;
    for (const p of store.values()) if (!last || p.startedAt > last.startedAt) last = p;
    return last;
  },
};

// Keep the last 20 entries only.
function trim() {
  if (store.size <= 20) return;
  const sorted = [...store.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const p of sorted.slice(0, store.size - 20)) store.delete(p.jobId);
}
