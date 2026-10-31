// ONE HEAVY JOB AT A TIME (guide §4.6): an in-process lock plus database
// guards that work across restarts (a running backup, an unfinished migration).

import { db } from "@/server/validation/db";
import { FilingError } from "./errors";

export type JobType =
  | "IMPORT"
  | "NORMALIZE"
  | "REFERENCE_CHECK"
  | "DISCOVERY"
  | "STORAGE_CHECK"
  | "BASE_URL_CHANGE"
  | "BACKUP"
  | "MIGRATION"
  | "PURGE"
  | "FIXES";

let currentJob: { type: JobType; id: string; startedAt: Date } | null = null;

export const runningJob = () => currentJob;

/** Read-only checks may run during an unfinished migration; data-changing jobs may not. */
const ALLOWED_DURING_MIGRATION: JobType[] = ["MIGRATION", "REFERENCE_CHECK", "DISCOVERY", "STORAGE_CHECK"];

export async function unfinishedMigration() {
  return db.fileStorage.findFirst({
    where: { isReadOnly: true, files: { some: { status: "ACTIVE" } } },
    select: { id: true, name: true, access: true },
  });
}

// Backups RUNNING for over 2 h with no runner in this process are marked FAILED.
export async function failStaleBackups(now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const busy = currentJob?.type === "BACKUP" ? currentJob.id : "-";
  await db.fileBackup.updateMany({
    where: { status: { in: ["RUNNING", "PENDING"] }, createdAt: { lt: cutoff }, id: { not: busy } },
    data: { status: "FAILED", error: "Interrupted", completedAt: now },
  });
}

export async function assertCanStart(type: JobType, opts: { ignoreBackupId?: string } = {}) {
  if (currentJob) throw new FilingError("FILING_JOB_IN_PROGRESS", `Another job is running (${currentJob.type.toLowerCase().replace("_", " ")}).`);
  await failStaleBackups();
  const backup = await db.fileBackup.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] }, ...(opts.ignoreBackupId ? { id: { not: opts.ignoreBackupId } } : {}) },
    select: { id: true },
  });
  if (backup) throw new FilingError("FILING_JOB_IN_PROGRESS", "A backup is running.");
  if (!ALLOWED_DURING_MIGRATION.includes(type) && (await unfinishedMigration())) {
    throw new FilingError("MIGRATION_NOT_FINISHED", "A storage migration is not finished. Resume or finish it first.");
  }
}

/** Runs `work` holding the lock. Call assertCanStart first (inside the action). */
export async function withLock<T>(type: JobType, id: string, work: () => Promise<T>): Promise<T> {
  if (currentJob) throw new FilingError("FILING_JOB_IN_PROGRESS", "Another job is running.");
  currentJob = { type, id, startedAt: new Date() };
  try {
    return await work();
  } finally {
    currentJob = null;
  }
}

/** Tests only. */
export const resetLock = () => {
  currentJob = null;
};
