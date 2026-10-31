// BACKUPS (guide §9): FULL = ACTIVE files uploaded up to toDate; INCREMENTAL =
// after the last COMPLETED backup's toDate (none → FULL). Each file is read
// from its own storage and streamed one entry at a time into a zip64 archive
// that is piped into a multipart upload: never held in memory or on disk.
// Archive: {prefix}/_backups/{yyyy-mm-dd}_{TYPE}_{id}.zip + manifest.json.

import { once } from "node:events";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { db, Prisma } from "@/server/validation/db";
import { FilingError } from "../errors";
import { progress } from "../progress";
import * as ops from "../storage/ops";
import { storages, type LoadedStorage } from "../storage/registry";
import { backupsArePublic } from "../storage/test";
import { buildUrl, canonicalBase } from "../storage/urls";

export type BackupType = "FULL" | "INCREMENTAL";

/** Where archives go: the active PUBLIC storage unless its _backups/ is public, else the active PRIVATE one. */
export async function archiveStorage(fetchImpl?: typeof fetch): Promise<LoadedStorage> {
  const active = [...(await storages()).values()].filter((s) => s.isActive && !s.isReadOnly);
  const pub = active.find((s) => s.access === "PUBLIC");
  const priv = active.find((s) => s.access === "PRIVATE");
  if (pub && !(await backupsArePublic(pub, fetchImpl))) return pub;
  if (priv) return priv;
  if (pub) throw new FilingError("BACKUP_NOT_READY", "Backups are refused: _backups/ is publicly readable and there is no private storage. Fix the bucket policy (see the storage test).");
  throw new FilingError("STORAGE_NOT_CONFIGURED", "No active storage to keep backups.");
}

export async function backupRange(type: BackupType, now = new Date()): Promise<{ type: BackupType; fromDate: Date | null; toDate: Date }> {
  if (type === "FULL") return { type, fromDate: null, toDate: now };
  const last = await db.fileBackup.findFirst({ where: { status: "COMPLETED" }, orderBy: { toDate: "desc" }, select: { toDate: true } });
  return last ? { type, fromDate: last.toDate, toDate: now } : { type: "FULL", fromDate: null, toDate: now };
}

export function backupWhere(r: { fromDate: Date | null; toDate: Date; folder?: string | null }): Prisma.FileWhereInput {
  return {
    status: "ACTIVE",
    uploadedAt: { lte: r.toDate, ...(r.fromDate ? { gt: r.fromDate } : {}) },
    ...(r.folder ? { OR: [{ folder: r.folder }, { folder: { startsWith: `${r.folder}/` } }] } : {}),
  };
}

const safe = (name: string) => name.replace(/[\\/\u0000-\u001f]+/g, "_").slice(0, 150) || "file";

export const archivePath = (f: { id: string; folder: string | null; name: string }) => `files/${f.folder ?? "_unfiled"}/${f.id.slice(0, 8)}_${safe(f.name)}`;

export async function runBackup(jobId: string, backupId: string, opts: { folder?: string | null } = {}) {
  const b = await db.fileBackup.findUnique({ where: { id: backupId } });
  if (!b || !b.storageId || !b.archiveKey) throw new FilingError("BACKUP_NOT_READY", "Backup not found.");
  const all = await storages();
  const target = all.get(b.storageId);
  if (!target) throw new FilingError("STORAGE_NOT_FOUND", "The backup storage is gone.");
  await db.fileBackup.update({ where: { id: b.id }, data: { status: "RUNNING" } });
  const where = backupWhere({ fromDate: b.fromDate, toDate: b.toDate, folder: opts.folder });
  progress.set(jobId, { phase: "ARCHIVING", total: await db.file.count({ where }) });

  const archive = archiver("zip", { forceZip64: true, zlib: { level: 1 } });
  const pass = new PassThrough();
  archive.pipe(pass);
  const upload = ops.uploadStream(target, b.archiveKey, pass, { contentType: "application/zip", cacheControl: "private, no-store" });
  const uploaded = upload.done();
  let archiveError: unknown = null;
  archive.on("error", (e) => (archiveError = e));
  archive.on("warning", (e) => console.warn("[filing] backup warning", e));

  const files: Record<string, unknown>[] = [];
  const skipped: { id: string; key: string; reason: string }[] = [];
  let count = 0;
  let size = 0;
  try {
    let cursor: string | undefined;
    for (;;) {
      const batch = await db.file.findMany({
        where,
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, key: true, storageId: true, name: true, folder: true, mimeType: true, size: true, uploadedAt: true },
      });
      if (!batch.length) break;
      for (const f of batch) {
        if (archiveError) throw archiveError;
        const s = all.get(f.storageId);
        if (!s) {
          skipped.push({ id: f.id, key: f.key, reason: "Storage removed" });
          continue;
        }
        let stream;
        try {
          stream = await ops.getStream(s, f.key);
        } catch (e) {
          if (!ops.isNotFound(e)) throw e;
          skipped.push({ id: f.id, key: f.key, reason: "NoSuchKey" });
          progress.inc(jobId, "failed");
          continue;
        }
        const path = archivePath(f);
        const entry = once(archive, "entry");
        archive.append(stream.body, { name: path, date: f.uploadedAt });
        await entry; // one entry at a time: flat memory
        count++;
        size += f.size;
        files.push({ ...f, url: buildUrl(s, f.key), path });
        progress.set(jobId, { done: count, bytes: size });
        if (count % 50 === 0) await db.fileBackup.update({ where: { id: b.id }, data: { fileCount: count, totalSize: BigInt(size) } });
      }
      cursor = batch[batch.length - 1].id;
    }
    const used = [...new Set(files.map((f) => f.storageId as string))].map((id) => all.get(id)!);
    const manifest = {
      app: target.prefix,
      backupId: b.id,
      type: b.type,
      fromDate: b.fromDate,
      toDate: b.toDate,
      folder: opts.folder ?? null,
      fileCount: count,
      totalSize: size,
      storages: used.map((s) => ({ id: s.id, name: s.name, access: s.access, canonicalBase: canonicalBase(s) })),
      skipped,
      files,
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    await archive.finalize();
    await uploaded;
    if (archiveError) throw archiveError;
    await db.fileBackup.update({
      where: { id: b.id },
      data: {
        status: "COMPLETED",
        fileCount: count,
        totalSize: BigInt(size),
        completedAt: new Date(),
        error: skipped.length ? `${skipped.length} file(s) skipped, see manifest.json` : null,
      },
    });
    return { backupId: b.id, archiveKey: b.archiveKey, storageId: target.id, summary: { files: count, bytes: size, skipped: skipped.length }, skipped };
  } catch (e) {
    archive.abort();
    await upload.abort().catch(() => {});
    await uploaded.catch(() => {});
    await db.fileBackup.update({ where: { id: b.id }, data: { status: "FAILED", error: ((e as Error)?.message ?? "Failed").slice(0, 500), completedAt: new Date() } });
    throw e;
  }
}
