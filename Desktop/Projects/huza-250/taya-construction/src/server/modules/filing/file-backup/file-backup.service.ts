// FILE BACKUP SERVICE: FULL / INCREMENTAL archives of the registered files (guide §9).
//
// Rules:
// - BAK-R1  INCREMENTAL starts at the toDate of the last COMPLETED backup; none → FULL
// - BAK-R2  not while another job or backup runs, or a migration is unfinished
// - BAK-R3  archives never go to a publicly readable _backups/ (private storage instead,
//           or refused)
// - BAK-R4  download = presigned GET (attachment, 5 min); delete removes the archive,
//           then the row, never while running

import "server-only";
import { db } from "@/server/validation/db";
import { pageArgs, toPage, type Page } from "@/server/validation/pagination";
import { FilingError } from "../lib/errors";
import { assertCanStart, failStaleBackups } from "../lib/lock";
import * as ops from "../lib/storage/ops";
import { getStorage } from "../lib/storage/registry";
import { archiveStorage, backupRange, backupWhere, runBackup, type BackupType } from "../lib/jobs/backup";
import { startJob } from "../lib/jobs/run";
import { backupSelect, toBackupDto, type BackupDto } from "./file-backup.select";

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function listBackups(query: { cursor?: string; limit: number }): Promise<Page<BackupDto> & { notBackedUp: { count: number; size: number } }> {
  await failStaleBackups();
  const rows = await db.fileBackup.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: backupSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  const last = await db.fileBackup.findFirst({ where: { status: "COMPLETED" }, orderBy: { toDate: "desc" }, select: { toDate: true } });
  const pending = await db.file.aggregate({ where: { status: "ACTIVE", ...(last ? { uploadedAt: { gt: last.toDate } } : {}) }, _count: { _all: true }, _sum: { size: true } });
  return { ...page, items: page.items.map(toBackupDto), notBackedUp: { count: pending._count._all, size: pending._sum.size ?? 0 } };
}

export async function getBackup(id: string): Promise<BackupDto> {
  const r = await db.fileBackup.findUnique({ where: { id }, select: backupSelect });
  if (!r) throw new FilingError("FILE_NOT_FOUND", "Backup not found.");
  return toBackupDto(r);
}

export async function estimate(input: { type: BackupType; folder: string | null }) {
  const range = await backupRange(input.type);
  const agg = await db.file.aggregate({ where: backupWhere({ ...range, folder: input.folder }), _count: { _all: true }, _sum: { size: true } });
  return { type: range.type, fromDate: range.fromDate, toDate: range.toDate, files: agg._count._all, size: agg._sum.size ?? 0 };
}

// BAK-R1, BAK-R2, BAK-R3.
export async function createBackup(input: { type: BackupType; folder: string | null }, userId: string | null, opts: { fetchImpl?: typeof fetch } = {}) {
  await assertCanStart("BACKUP");
  const range = await backupRange(input.type);
  const storage = await archiveStorage(opts.fetchImpl);
  const row = await db.fileBackup.create({
    data: { type: range.type, fromDate: range.fromDate, toDate: range.toDate, status: "PENDING", createdBy: userId, storageId: storage.id },
    select: { id: true },
  });
  const archiveKey = `${storage.prefix}/_backups/${day(range.toDate)}_${range.type}_${row.id}.zip`;
  await db.fileBackup.update({ where: { id: row.id }, data: { archiveKey } });
  const job = await startJob("BACKUP", { id: row.id, ignoreBackupId: row.id }, (jobId) => runBackup(jobId, row.id, { folder: input.folder })).catch(async (e) => {
    await db.fileBackup.update({ where: { id: row.id }, data: { status: "FAILED", error: (e as Error).message, completedAt: new Date() } });
    throw e;
  });
  return { backup: await getBackup(row.id), jobId: job.jobId, done: job.done };
}

// BAK-R4.
export async function downloadUrl(id: string): Promise<string> {
  const b = await db.fileBackup.findUnique({ where: { id }, select: { status: true, archiveKey: true, storageId: true, type: true, toDate: true } });
  if (!b) throw new FilingError("FILE_NOT_FOUND", "Backup not found.");
  if (b.status !== "COMPLETED" || !b.archiveKey || !b.storageId) throw new FilingError("BACKUP_NOT_READY", "This backup is not ready.");
  const s = await getStorage(b.storageId);
  return ops.presignGet(s, b.archiveKey, 300, `${s.prefix}_${b.type}_${day(b.toDate)}.zip`);
}

export async function deleteBackup(id: string): Promise<{ id: string }> {
  const b = await db.fileBackup.findUnique({ where: { id }, select: { status: true, archiveKey: true, storageId: true } });
  if (!b) throw new FilingError("FILE_NOT_FOUND", "Backup not found.");
  if (b.status === "RUNNING" || b.status === "PENDING") throw new FilingError("FILING_JOB_IN_PROGRESS", "This backup is still running.");
  if (b.archiveKey && b.storageId) await ops.remove(await getStorage(b.storageId), b.archiveKey);
  await db.fileBackup.delete({ where: { id } });
  return { id };
}
