// STORAGE_CHECK (guide §8.5): registry vs storage for one storage.
// orphans (objects without an ACTIVE row) · missing (ACTIVE rows without an
// object) · size mismatch. Fixes: mark missing DELETED, fix sizes.

import { db } from "@/server/validation/db";
import { FilingError } from "../errors";
import { progress } from "../progress";
import { readReport } from "../reports";
import * as ops from "../storage/ops";
import { getStorage } from "../storage/registry";
import { isOwnKey } from "../storage/urls";
import { cap } from "./common";

export type StorageCheckReport = {
  storageId: string;
  summary: { objects: number; rows: number; orphans: number; missing: number; sizeMismatch: number };
  orphans: { key: string; size: number; lastModified: string | null }[];
  missing: { id: string; key: string }[];
  sizeMismatch: { id: string; key: string; registered: number; actual: number }[];
};

export async function runStorageCheck(jobId: string, opts: { storageId: string }): Promise<StorageCheckReport> {
  const s = await getStorage(opts.storageId);
  const objects = new Map<string, { size: number; lastModified: Date | null }>();
  progress.set(jobId, { phase: "LISTING" });
  for await (const o of ops.list(s, `${s.prefix}/`)) {
    if (!isOwnKey(s, o.key)) continue;
    objects.set(o.key, { size: o.size, lastModified: o.lastModified });
    if (objects.size % 1000 === 0) progress.set(jobId, { done: objects.size });
  }
  progress.set(jobId, { phase: "COMPARING" });
  const missing: StorageCheckReport["missing"] = [];
  const sizeMismatch: StorageCheckReport["sizeMismatch"] = [];
  const seen = new Set<string>();
  let rows = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.file.findMany({
      where: { storageId: s.id, status: "ACTIVE" },
      orderBy: { id: "asc" },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, key: true, size: true },
    });
    if (!batch.length) break;
    for (const f of batch) {
      rows++;
      seen.add(f.key);
      const o = objects.get(f.key);
      if (!o) missing.push({ id: f.id, key: f.key });
      else if (o.size !== f.size) sizeMismatch.push({ id: f.id, key: f.key, registered: f.size, actual: o.size });
    }
    cursor = batch[batch.length - 1].id;
  }
  const orphans = [...objects].filter(([k]) => !seen.has(k)).map(([key, o]) => ({ key, size: o.size, lastModified: o.lastModified?.toISOString() ?? null }));
  return {
    storageId: s.id,
    summary: { objects: objects.size, rows, orphans: orphans.length, missing: missing.length, sizeMismatch: sizeMismatch.length },
    orphans: cap(orphans, 100_000),
    missing: cap(missing, 100_000),
    sizeMismatch: cap(sizeMismatch, 100_000),
  };
}

/** Fixes from a saved STORAGE_CHECK report, re-verified against storage first. */
export async function applyStorageFixes(jobId: string, opts: { reportName: string; markMissing: boolean; fixSizes: boolean; dryRun: boolean }) {
  const r = await readReport<StorageCheckReport & { type: string }>(opts.reportName);
  if (!r || r.type !== "STORAGE_CHECK") throw new FilingError("FILE_NOT_FOUND", "Report not found.");
  const s = await getStorage(r.storageId);
  let marked = 0;
  let resized = 0;
  if (opts.markMissing) {
    for (const m of r.missing) {
      if (await ops.head(s, m.key)) continue; // came back
      if (!opts.dryRun) marked += (await db.file.updateMany({ where: { id: m.id, storageId: s.id, status: "ACTIVE" }, data: { status: "DELETED", deletedAt: new Date() } })).count;
      else marked++;
      progress.inc(jobId, "done");
    }
  }
  if (opts.fixSizes) {
    for (const m of r.sizeMismatch) {
      const h = await ops.head(s, m.key);
      if (!h) continue;
      if (!opts.dryRun) resized += (await db.file.updateMany({ where: { id: m.id }, data: { size: h.size } })).count;
      else resized++;
      progress.inc(jobId, "done");
    }
  }
  return { reportName: opts.reportName, summary: { markedDeleted: marked, sizesFixed: resized } };
}
