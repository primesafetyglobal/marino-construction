// STORAGE MIGRATION (guide §10). Zero downtime:
// - start (one transaction): target active, source inactive + read-only
// - copy: pLimit(4), cursor batches of 200, conditional storageId switch, final
//   passes for late uploads and failures (3 retries), resumable, cancellable
// - swap: source canonical base → target canonical base in every declared
//   reference, then verification: no row may still hold any source base (= 0)
// - retention, then purge: deletes source objects only where the target has a copy
// "In progress" is derived: a read-only storage that still has ACTIVE files.

import pLimit from "p-limit";
import { db } from "@/server/validation/db";
import { FilingError } from "../errors";
import { runningJob } from "../lock";
import { progress } from "../progress";
import { latestReport } from "../reports";
import { references } from "../references/registry";
import { countWithBase, rewriteReference } from "../references/rewrite";
import * as ops from "../storage/ops";
import { getStorage, invalidateStorages, storages, type LoadedStorage } from "../storage/registry";
import { testStorage } from "../storage/test";
import { baseVariants, canonicalBase, imageHost } from "../storage/urls";
import { recentDiscovery } from "./discovery";
import { sleep } from "./run";

export const RETENTION_DAYS = 30;
const DAY = 24 * 3600 * 1000;

export type PrecheckItem = { id: string; label: string; ok: boolean; detail?: string; skippable?: boolean };

/** Image hosts allowed by next.config at build time (see next.config.ts). */
export const configuredImageHosts = () => (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(",").filter(Boolean);

// ======================= Precheck (§10.1) =======================

export async function precheck(sourceId: string, targetId: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<{ ok: boolean; items: PrecheckItem[] }> {
  const source = await getStorage(sourceId);
  const target = await getStorage(targetId);
  const items: PrecheckItem[] = [];
  const add = (i: PrecheckItem) => items.push(i);

  const sameAddress = source.bucket === target.bucket && source.endpoint === target.endpoint && source.prefix === target.prefix;
  add({ id: "different", label: "Target is another storage (same bucket and prefix is a base-URL change)", ok: source.id !== target.id && !sameAddress });
  add({ id: "access", label: "Same access as the source", ok: source.access === target.access, detail: `${source.access} → ${target.access}` });
  add({ id: "prefix", label: "Same prefix as the source (keys are copied unchanged)", ok: source.prefix === target.prefix, detail: `${source.prefix} → ${target.prefix}` });
  const targetFiles = await db.file.count({ where: { storageId: target.id, status: "ACTIVE" } });
  add({ id: "target-free", label: "Target is not read-only with files of its own", ok: !target.isReadOnly || targetFiles === 0 });
  const test = await testStorage(target, { fetchImpl: opts.fetchImpl });
  add({ id: "test", label: "Target storage test passed", ok: test.ok, detail: test.checks.filter((c) => !c.ok && !c.warning).map((c) => c.name).join(", ") || undefined });
  if (target.access === "PUBLIC") {
    const host = imageHost(target);
    add({ id: "image-host", label: "Target host allowed in next.config images and deployed", ok: configuredImageHosts().includes(host), detail: host });
  }
  const discovery = await recentDiscovery().catch(() => null);
  add({
    id: "discovery",
    label: "Discovery run in the last 24 h with no unhandled findings",
    ok: !!discovery && discovery.summary.unhandled === 0,
    detail: discovery ? `${discovery.summary.unhandled} unhandled` : "not run",
  });
  let nonCanonical = 0;
  const canon = canonicalBase(source);
  for (const v of baseVariants(source)) {
    if (v === canon || canon.startsWith(`${v}/`)) continue;
    for (const ref of references()) nonCanonical += await countWithBase(ref, v);
  }
  add({ id: "normalize", label: "Normalize done (no non-canonical source URLs)", ok: nonCanonical === 0, detail: `${nonCanonical} row(s)` });
  const backup = await db.fileBackup.findFirst({ where: { status: "COMPLETED", type: "FULL", completedAt: { gte: new Date(Date.now() - DAY) } }, select: { id: true } });
  add({ id: "backup", label: "FULL backup completed in the last 24 h (recommended)", ok: !!backup, skippable: true });
  const running = await db.fileBackup.count({ where: { status: { in: ["PENDING", "RUNNING"] } } });
  add({ id: "idle", label: "No other heavy job running", ok: !runningJob() && running === 0 });
  return { ok: items.every((i) => i.ok || i.skippable), items };
}

// ======================= Start (§10.2) =======================

export async function startMigrationTx(sourceId: string, targetId: string, opts: { skipBackup?: boolean; fetchImpl?: typeof fetch } = {}) {
  const check = await precheck(sourceId, targetId, opts);
  const failed = check.items.filter((i) => !i.ok && !(i.skippable && opts.skipBackup));
  if (failed.length) throw new FilingError("MIGRATION_PRECHECK_FAILED", `Precheck failed: ${failed.map((i) => i.label).join("; ")}.`);
  await db.$transaction([
    db.fileStorage.update({ where: { id: targetId }, data: { isActive: true, isReadOnly: false } }),
    db.fileStorage.update({ where: { id: sourceId }, data: { isActive: false, isReadOnly: true } }),
  ]);
  invalidateStorages();
  return check;
}

/** The unfinished migration of an access: read-only source with ACTIVE files → active target. */
export async function migrationPair(sourceId: string): Promise<{ source: LoadedStorage; target: LoadedStorage }> {
  invalidateStorages();
  const source = await getStorage(sourceId);
  if (!source.isReadOnly) throw new FilingError("MIGRATION_PRECHECK_FAILED", "This storage is not being migrated.");
  const target = [...(await storages()).values()].find((s) => s.isActive && !s.isReadOnly && s.access === source.access);
  if (!target) throw new FilingError("STORAGE_NOT_CONFIGURED", `No active ${source.access.toLowerCase()} storage to migrate to.`);
  return { source, target };
}

// ======================= Copy (§10.3) + swap (§10.4) =======================

let cancelRequested = false;
export const requestCancel = () => {
  cancelRequested = true;
};

export type MigrationReport = {
  sourceId: string;
  targetId: string;
  summary: { copied: number; bytes: number; missing: number; failures: number; remaining: number; swapped: number; verification: number | null };
  missing: string[];
  failures: { key: string; reason: string }[];
  swap: { table: string; column: string; rows: number }[];
  verification: { table: string; column: string; base: string; rows: number }[];
  finished: boolean;
  cancelled: boolean;
};

export async function runMigration(jobId: string, sourceId: string, opts: { batchPauseMs?: number } = {}): Promise<MigrationReport> {
  cancelRequested = false;
  const { source, target } = await migrationPair(sourceId);
  const report: MigrationReport = {
    sourceId: source.id,
    targetId: target.id,
    summary: { copied: 0, bytes: 0, missing: 0, failures: 0, remaining: 0, swapped: 0, verification: null },
    missing: [],
    failures: [],
    swap: [],
    verification: [],
    finished: false,
    cancelled: false,
  };
  progress.set(jobId, { phase: "COPY", total: await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } }) });
  const pause = opts.batchPauseMs ?? 100;
  let concurrency = 4;
  const attempts = new Map<string, number>();
  const missing = new Set<string>();

  const copyOne = async (f: { id: string; key: string }) => {
    try {
      const bytes = await ops.copyBetween(source, target, f.key);
      const res = await db.file.updateMany({ where: { id: f.id, storageId: source.id, status: "ACTIVE" }, data: { storageId: target.id } });
      if (res.count === 0) {
        await ops.remove(target, f.key).catch(() => {}); // deleted meanwhile: drop the copy
      } else {
        report.summary.copied++;
        report.summary.bytes += bytes;
        progress.inc(jobId, "done");
        progress.inc(jobId, "bytes", bytes);
      }
      return null;
    } catch (e) {
      if (ops.isNotFound(e)) missing.add(f.key);
      else attempts.set(f.key, (attempts.get(f.key) ?? 0) + 1);
      return e;
    }
  };

  const pass = async (opts2: { retry: boolean }) => {
    let cursor: string | undefined;
    for (;;) {
      if (cancelRequested) return;
      const batch = await db.file.findMany({
        where: { storageId: source.id, status: "ACTIVE" },
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, key: true },
      });
      if (!batch.length) return;
      const todo = batch.filter((f) => !missing.has(f.key) && (!opts2.retry || (attempts.get(f.key) ?? 0) < 4));
      const limit = pLimit(concurrency);
      const errors = await Promise.all(todo.map((f) => limit(() => copyOne(f))));
      // Throttling (503 SlowDown): halve concurrency.
      const throttled = errors.filter((e) => e && /SlowDown|503/i.test(String((e as Error).message ?? e))).length;
      if (throttled > 2) concurrency = Math.max(1, Math.floor(concurrency / 2));
      cursor = batch[batch.length - 1].id;
      await sleep(pause);
    }
  };

  await pass({ retry: false });
  // Final passes without cursor state: late uploads from lagging instances, earlier failures (3 retries).
  for (let i = 0; i < 3 && !cancelRequested; i++) {
    const left = await db.file.count({ where: { storageId: source.id, status: "ACTIVE", key: { notIn: [...missing] } } });
    if (!left) break;
    await pass({ retry: true });
  }

  report.missing = [...missing];
  report.summary.missing = missing.size;
  const remaining = await db.file.findMany({ where: { storageId: source.id, status: "ACTIVE" }, select: { key: true }, take: 1000 });
  report.summary.remaining = await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } });
  report.failures = remaining.filter((r) => !missing.has(r.key)).map((r) => ({ key: r.key, reason: `failed after ${attempts.get(r.key) ?? 0} attempt(s)` }));
  report.summary.failures = report.failures.length;
  if (cancelRequested) {
    report.cancelled = true;
    cancelRequested = false;
    return report;
  }
  if (report.summary.remaining > 0) return report; // missing objects or failures block the swap
  await swapAndVerify(jobId, source, target, report);
  return report;
}

export async function swapAndVerify(jobId: string, source: LoadedStorage, target: LoadedStorage, report: MigrationReport) {
  progress.set(jobId, { phase: "SWAP" });
  const from = canonicalBase(source);
  const to = canonicalBase(target);
  for (const ref of references()) {
    const rows = await rewriteReference(ref, from, to);
    report.swap.push({ table: ref.table, column: ref.column, rows });
    report.summary.swapped += rows;
  }
  progress.set(jobId, { phase: "VERIFY" });
  let left = 0;
  for (const ref of references()) {
    for (const base of baseVariants(source)) {
      if (to.startsWith(`${base}/`) || to === base) continue;
      const rows = await countWithBase(ref, base);
      if (rows) report.verification.push({ table: ref.table, column: ref.column, base, rows });
      left += rows;
    }
  }
  report.summary.verification = left;
  report.finished = left === 0;
}

/** "Finish migration": copy is done (0 ACTIVE files on the source); swap + verify again. */
export async function runFinish(jobId: string, sourceId: string): Promise<MigrationReport> {
  const source = await getStorage(sourceId);
  if (!source.isReadOnly) throw new FilingError("MIGRATION_PRECHECK_FAILED", "This storage is not being migrated.");
  const left = await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } });
  if (left) throw new FilingError("MIGRATION_NOT_FINISHED", `${left} file(s) are still on the source. Resume the copy, or mark missing files deleted.`);
  const target = [...(await storages()).values()].find((s) => s.isActive && !s.isReadOnly && s.access === source.access);
  if (!target) throw new FilingError("STORAGE_NOT_CONFIGURED", "No active target storage.");
  const report: MigrationReport = {
    sourceId,
    targetId: target.id,
    summary: { copied: 0, bytes: 0, missing: 0, failures: 0, remaining: 0, swapped: 0, verification: null },
    missing: [],
    failures: [],
    swap: [],
    verification: [],
    finished: false,
    cancelled: false,
  };
  await swapAndVerify(jobId, source, target, report);
  return report;
}

/** Missing objects block the finish: after checking, the admin marks them DELETED. */
export async function markMissingDeleted(sourceId: string, keys: string[]) {
  const source = await getStorage(sourceId);
  let marked = 0;
  for (const key of keys) {
    if (await ops.head(source, key)) continue;
    marked += (await db.file.updateMany({ where: { key, storageId: source.id, status: "ACTIVE" }, data: { status: "DELETED", deletedAt: new Date() } })).count;
  }
  return { marked };
}

// ======================= Purge (§10.5) =======================

export async function purgePrecheck(sourceId: string, now = new Date()) {
  const source = await getStorage(sourceId);
  const active = await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } });
  let refs = 0;
  for (const ref of references()) for (const base of baseVariants(source)) refs += await countWithBase(ref, base);
  const retentionEndsAt = new Date(source.updatedAt.getTime() + RETENTION_DAYS * DAY);
  return { source, active, refs, retentionEndsAt, retentionOver: now >= retentionEndsAt };
}

export async function runPurge(jobId: string, sourceId: string, opts: { now?: Date; deleteBackups?: boolean } = {}) {
  const pre = await purgePrecheck(sourceId, opts.now);
  const { source } = pre;
  if (!source.isReadOnly) throw new FilingError("MIGRATION_PRECHECK_FAILED", "Only a read-only (migrated) storage can be purged.");
  if (pre.active) throw new FilingError("MIGRATION_NOT_FINISHED", "The migration is not finished.");
  if (pre.refs) throw new FilingError("MIGRATION_PRECHECK_FAILED", `${pre.refs} row(s) still use the old storage address. Run the reference check first.`);
  if (!pre.retentionOver) throw new FilingError("MIGRATION_PRECHECK_FAILED", `Retention runs until ${pre.retentionEndsAt.toISOString().slice(0, 10)}.`);
  const target = [...(await storages()).values()].find((s) => s.isActive && !s.isReadOnly && s.access === source.access);
  if (!target) throw new FilingError("STORAGE_NOT_CONFIGURED", "No active target storage.");

  progress.set(jobId, { phase: "BACKUPS" });
  // Backup archives move to the target first (or are deleted with confirmation).
  const backups = await db.fileBackup.findMany({ where: { storageId: source.id }, select: { id: true, archiveKey: true, status: true } });
  for (const b of backups) {
    if (b.status === "RUNNING" || b.status === "PENDING") throw new FilingError("FILING_JOB_IN_PROGRESS", "A backup on this storage is running.");
    if (opts.deleteBackups) {
      if (b.archiveKey) await ops.remove(source, b.archiveKey);
      await db.fileBackup.delete({ where: { id: b.id } });
    } else {
      if (b.archiveKey && (await ops.head(source, b.archiveKey))) await ops.copyBetween(source, target, b.archiveKey);
      await db.fileBackup.update({ where: { id: b.id }, data: { storageId: target.id } });
    }
  }

  progress.set(jobId, { phase: "PURGE" });
  let deleted = 0;
  const kept: { key: string; reason: string }[] = [];
  for await (const o of ops.list(source, `${source.prefix}/`)) {
    const isSystem = o.key.startsWith(`${source.prefix}/_system/`) || o.key.startsWith(`${source.prefix}/_backups/`);
    if (isSystem) {
      // Reports and archives: keep a copy on the target, then delete.
      if (!(await ops.head(target, o.key))) await ops.copyBetween(source, target, o.key).catch(() => {});
    }
    const copy = await ops.head(target, o.key);
    if (!copy || copy.size !== o.size) {
      kept.push({ key: o.key, reason: copy ? "size differs on target" : "no copy on target" });
      continue;
    }
    await ops.remove(source, o.key);
    deleted++;
    progress.inc(jobId, "done");
  }
  // History rows (DELETED) follow the files, so the storage can be deleted.
  const moved = await db.file.updateMany({ where: { storageId: source.id }, data: { storageId: target.id } });
  invalidateStorages();
  return { sourceId, targetId: target.id, summary: { deleted, kept: kept.length, historyRowsMoved: moved.count, backupsMoved: opts.deleteBackups ? 0 : backups.length }, kept };
}

/** For the Storage page: the unfinished migration, if any, and its last report. */
export async function migrationState() {
  const sources = await db.fileStorage.findMany({ where: { isReadOnly: true }, select: { id: true, name: true, access: true, updatedAt: true, _count: { select: { files: { where: { status: "ACTIVE" } } } } } });
  const last = await latestReport<MigrationReport>("MIGRATION").catch(() => null);
  return {
    sources: sources.map((s) => ({ id: s.id, name: s.name, access: s.access, activeFiles: s._count.files, unfinished: s._count.files > 0, retentionEndsAt: new Date(s.updatedAt.getTime() + RETENTION_DAYS * DAY) })),
    lastReport: last ? { name: last.meta.name, ...last.data } : null,
  };
}
