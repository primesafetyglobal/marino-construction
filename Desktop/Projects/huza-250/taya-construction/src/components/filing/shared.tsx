"use client";
// Shared bits of the Files admin (Filing guide §13). CLIENT-SAFE.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { Progress } from "@/server/modules/filing/lib/progress";

export type FilingCan = {
  fileRead: boolean;
  fileCreate: boolean;
  fileUpdate: boolean;
  fileDelete: boolean;
  storageRead: boolean;
  storageCreate: boolean;
  storageUpdate: boolean;
  storageDelete: boolean;
  settingsRead: boolean;
  settingsUpdate: boolean;
  backupRead: boolean;
  backupCreate: boolean;
  backupDelete: boolean;
};

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export type CurrentJob = {
  running: { type: string; id: string; startedAt: string } | null;
  progress: Progress | null;
  migration: { id: string; name: string; access: string } | null;
};

/** Polls the running job every 1.5 s while one runs (and once on mount). */
export function useCurrentJob(onFinish?: (p: Progress) => void) {
  const [job, setJob] = useState<CurrentJob | null>(null);
  const [tick, setTick] = useState(0);
  const lastRunning = useRef<string | null>(null);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const res = await apiGet<CurrentJob>("/api/v1/filing/jobs/current");
      if (stop || !res.ok) return;
      const data = res.data as unknown as CurrentJob;
      setJob(data);
      const runningId = data.running?.id ?? null;
      if (lastRunning.current && !runningId && data.progress) finish.current?.(data.progress);
      lastRunning.current = runningId;
      if (runningId) timer = setTimeout(load, 1500);
    };
    load();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [tick]);

  return { job, refresh, busy: !!job?.running };
}

export function ProgressCard({ p, className }: { p: Progress | null; className?: string }) {
  if (!p) return null;
  const pct = p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : null;
  const running = !p.finishedAt;
  return (
    <div className={cn("rounded-2xl border border-line/60 bg-white p-4 text-sm shadow-soft", className)} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">
          {running && <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />}
          {p.type.replace(/_/g, " ").toLowerCase()} · {p.phase.replace(/_/g, " ").toLowerCase()}
        </p>
        <span className="text-xs text-muted">{new Date(p.startedAt).toLocaleTimeString()}</span>
      </div>
      {pct !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist">
          <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {p.done}
        {p.total ? ` / ${p.total}` : ""} done{p.failed ? ` · ${p.failed} failed` : ""}
        {p.bytes ? ` · ${formatBytes(p.bytes)}` : ""}
        {p.message ? ` · ${p.message}` : ""}
      </p>
      {p.error && <p className="mt-1 text-xs font-medium text-danger">{p.error}</p>}
      {p.reportName && <p className="mt-1 text-xs text-muted">Report: {p.reportName}</p>}
    </div>
  );
}
