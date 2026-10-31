// BACKGROUND JOBS (guide §9.4): an action checks and takes the lock, starts the
// work at once and returns the job id; the work keeps running after the
// response through after(). Live progress in memory, full report in storage.
// Outside a request (tests, scripts) the promise is simply returned.

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { progress } from "../progress";
import { writeReport } from "../reports";
import { assertCanStart, withLock, type JobType } from "../lock";

export type JobStart = { jobId: string; type: JobType };

export type JobBody = { summary: Record<string, unknown> } & Record<string, unknown>;
export type JobReport = JobBody & { type: JobType; id: string; dryRun: boolean; startedAt: string; finishedAt: string };

/** Report categories are capped in the UI; the full JSON is downloadable. */
export const UI_CAP = 1000;

export async function startJob(
  type: JobType,
  opts: { dryRun?: boolean; id?: string; ignoreBackupId?: string },
  work: (jobId: string) => Promise<JobBody>,
): Promise<JobStart & { done: Promise<JobReport | null> }> {
  await assertCanStart(type, { ignoreBackupId: opts.ignoreBackupId });
  const jobId = opts.id ?? randomUUID();
  const startedAt = new Date().toISOString();
  progress.start(jobId, type, opts.dryRun ? "DRY_RUN" : "RUNNING");
  const done = withLock(type, jobId, async () => {
    try {
      const body = await work(jobId);
      const report: JobReport = { type, id: jobId, dryRun: !!opts.dryRun, startedAt, finishedAt: new Date().toISOString(), ...body };
      const reportName = await writeReport(type, jobId, report).catch((e) => {
        console.error("[filing] report write failed", e);
        return null;
      });
      progress.finish(jobId, { reportName, message: summaryLine(report.summary) });
      return report;
    } catch (e) {
      console.error(`[filing] ${type} failed`, e);
      progress.finish(jobId, { phase: "FAILED", error: (e as Error)?.message ?? "Failed" });
      return null;
    }
  });
  try {
    after(() => done);
  } catch {
    // Not inside a request (tests, scripts): the caller awaits `done`.
  }
  return { jobId, type, done };
}

const summaryLine = (s: Record<string, unknown>) =>
  Object.entries(s)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
