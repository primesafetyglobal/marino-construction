// JOBS SERVICE: starts the heavy jobs in the background (guide §8, §10) and
// answers their live state. One job at a time (lib/lock.ts); every job has a
// dry run where it changes data, a live progress and a report in storage.
//
// Rules:
// - JOB-R1  one heavy job at a time; none while a backup runs; only read-only checks
//           and the migration itself while a migration is unfinished
// - JOB-R2  data-changing jobs default to a dry run in the schemas
// - JOB-R3  fixes are applied from a saved report and re-verified first
// - JOB-R4  purge needs a typed confirmation, a finished migration, no remaining
//           references and the end of the retention period

import "server-only";
import { db } from "@/server/validation/db";
import { FilingError } from "../lib/errors";
import { runningJob, unfinishedMigration } from "../lib/lock";
import { progress } from "../lib/progress";
import { listReports, readReport } from "../lib/reports";
import { countUsage } from "../lib/references/usage";
import * as ops from "../lib/storage/ops";
import { getStorage, invalidateStorages } from "../lib/storage/registry";
import { buildUrl } from "../lib/storage/urls";
import { runBaseUrlChange } from "../lib/jobs/base-url-change";
import { markFalsePositives, runDiscovery } from "../lib/jobs/discovery";
import { runImport } from "../lib/jobs/import";
import { markMissingDeleted, migrationState, precheck, requestCancel, runFinish, runMigration, runPurge, startMigrationTx } from "../lib/jobs/migration";
import { runNormalize } from "../lib/jobs/normalize";
import { applyFixes as applyReferenceFixes, runReferenceCheck, type FixCategory } from "../lib/jobs/reference-check";
import { startJob } from "../lib/jobs/run";
import { applyStorageFixes as applyStorageCheckFixes, runStorageCheck } from "../lib/jobs/storage-check";
import { deleteFiles } from "../file/file.service";

type Check = "NORMALIZE" | "REFERENCE_CHECK" | "DISCOVERY" | "STORAGE_CHECK";

// Actions return the job id only; tests await `done`.
const started = async <T extends { jobId: string; type: string; done: Promise<unknown> }>(p: Promise<T>) => p;

export function startImport(input: { storageId: string; dryRun: boolean }) {
  return started(startJob("IMPORT", { dryRun: input.dryRun }, (jobId) => runImport(jobId, input)));
}

export function startCheck(input: { type: Check; storageId?: string; dryRun: boolean }) {
  switch (input.type) {
    case "NORMALIZE":
      return started(startJob("NORMALIZE", { dryRun: input.dryRun }, (jobId) => runNormalize(jobId, { dryRun: input.dryRun })));
    case "REFERENCE_CHECK":
      return started(startJob("REFERENCE_CHECK", {}, (jobId) => runReferenceCheck(jobId)));
    case "DISCOVERY":
      return started(startJob("DISCOVERY", {}, () => runDiscovery()));
    case "STORAGE_CHECK":
      return started(startJob("STORAGE_CHECK", {}, (jobId) => runStorageCheck(jobId, { storageId: input.storageId! })));
  }
}

export function startReferenceFixes(input: { reportName: string; categories: FixCategory[]; dryRun: boolean }) {
  return started(startJob("FIXES", { dryRun: input.dryRun }, (jobId) => applyReferenceFixes(jobId, input)));
}

export function startStorageFixes(input: { reportName: string; markMissing: boolean; fixSizes: boolean; dryRun: boolean }) {
  return started(startJob("FIXES", { dryRun: input.dryRun }, (jobId) => applyStorageCheckFixes(jobId, input)));
}

// Abandoned uploads from an IMPORT report, re-checked: still unreferenced.
export async function deleteAbandoned(input: { reportName: string; keys?: string[] }) {
  const r = await readReport<{ type: string; storageId: string; abandoned: { key: string }[] }>(input.reportName);
  if (!r || r.type !== "IMPORT") throw new FilingError("FILE_NOT_FOUND", "Report not found.");
  const s = await getStorage(r.storageId);
  if (s.isReadOnly) throw new FilingError("STORAGE_READ_ONLY", "This storage is being migrated.");
  const wanted = new Set(input.keys ?? r.abandoned.map((a) => a.key));
  let deleted = 0;
  let kept = 0;
  for (const { key } of r.abandoned) {
    if (!wanted.has(key)) continue;
    const file = await db.file.findUnique({ where: { key }, select: { id: true, legacyUrl: true, status: true } });
    const usage = await countUsage([buildUrl(s, key), ...(file?.legacyUrl ? [file.legacyUrl] : [])]);
    if (usage.length) {
      kept++;
      continue;
    }
    if (file?.status === "ACTIVE") deleted += (await deleteFiles([file.id])).deleted;
    else {
      await ops.remove(s, key);
      deleted++;
    }
  }
  return { deleted, kept };
}

export const markDiscoveryFalsePositives = (input: { reportName: string; columns: string[] }) => markFalsePositives(input.reportName, input.columns);

export function startBaseUrlChange(input: { storageId: string; publicBaseUrl: string | null; dryRun: boolean }) {
  return started(startJob("BASE_URL_CHANGE", { dryRun: input.dryRun }, (jobId) => runBaseUrlChange(jobId, input)));
}

// ======================= Migration =======================

export const migrationPrecheck = (input: { sourceId: string; targetId: string }) => precheck(input.sourceId, input.targetId);

export async function startMigration(input: { sourceId: string; targetId: string; skipBackup: boolean }) {
  if (runningJob()) throw new FilingError("FILING_JOB_IN_PROGRESS", "Another job is running.");
  if (await unfinishedMigration()) throw new FilingError("MIGRATION_NOT_FINISHED", "A migration is not finished. Resume or finish it first.");
  await startMigrationTx(input.sourceId, input.targetId, { skipBackup: input.skipBackup });
  return started(startJob("MIGRATION", {}, (jobId) => runMigration(jobId, input.sourceId)));
}

export function resumeMigration(input: { sourceId: string }) {
  return started(startJob("MIGRATION", {}, (jobId) => runMigration(jobId, input.sourceId)));
}

export function cancelMigration() {
  if (runningJob()?.type !== "MIGRATION") throw new FilingError("MIGRATION_NOT_FINISHED", "No migration copy is running.");
  requestCancel();
  return { cancelled: true };
}

export function finishMigration(input: { sourceId: string }) {
  return started(startJob("MIGRATION", {}, (jobId) => runFinish(jobId, input.sourceId)));
}

export const markMigrationMissing = (input: { sourceId: string; keys: string[] }) => markMissingDeleted(input.sourceId, input.keys);

export async function startPurge(input: { sourceId: string; confirmName: string; deleteBackups: boolean }) {
  const s = await getStorage(input.sourceId);
  if (input.confirmName !== s.name) throw new FilingError("MIGRATION_PRECHECK_FAILED", "Type the storage name exactly to confirm.", { confirmName: ["Does not match."] });
  const job = await startJob("PURGE", {}, (jobId) => runPurge(jobId, input.sourceId, { deleteBackups: input.deleteBackups }));
  void job.done.then(() => invalidateStorages());
  return job;
}

// ======================= Reads =======================

export async function currentJob() {
  const running = runningJob();
  const latest = progress.latest();
  const migration = await unfinishedMigration();
  return { running, progress: running ? progress.get(running.id) : latest, migration };
}

export const reports = (limit: number) => listReports(limit);

export async function report(name: string) {
  const data = await readReport(name);
  if (!data) throw new FilingError("FILE_NOT_FOUND", "Report not found.");
  return data;
}

export const getMigrationState = () => migrationState();
