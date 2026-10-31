// Filing backups and storage migration (guide §19 "Backups", "Migration").
import "./mocks";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/validation/db";
import { isFilingError } from "@/server/modules/filing/lib/errors";
import { progress } from "@/server/modules/filing/lib/progress";
import { references } from "@/server/modules/filing/lib/references/registry";
import { countWithBase } from "@/server/modules/filing/lib/references/rewrite";
import { invalidateStorages } from "@/server/modules/filing/lib/storage/registry";
import { deleteFiles, uploadFile } from "@/server/modules/filing/file/file.service";
import { createBackup, deleteBackup, downloadUrl, listBackups } from "@/server/modules/filing/file-backup/file-backup.service";
import { deleteStorage } from "@/server/modules/filing/file-storage/file-storage.service";
import * as jobs from "@/server/modules/filing/jobs/jobs.service";
import { makeCategory, makeEquipment, makeServiceRequest } from "../auth/fixtures";
import { fake } from "./fake-s3";
import { PDF, PNG, base, blob, makeStorage, resetFiling, seedObject } from "./helpers";

beforeEach(resetFiling);

function unzip(buf: Buffer, entry: string): string {
  const dir = mkdtempSync(join(tmpdir(), "filing-zip-"));
  const file = join(dir, "a.zip");
  writeFileSync(file, buf);
  return execFileSync("unzip", ["-p", file, entry]).toString("utf8");
}
const listZip = (buf: Buffer) => {
  const dir = mkdtempSync(join(tmpdir(), "filing-zip-"));
  const file = join(dir, "a.zip");
  writeFileSync(file, buf);
  return execFileSync("unzip", ["-Z1", file]).toString("utf8").trim().split("\n").sort();
};

describe("backups", () => {
  it("BAK-R1 FULL takes every ACTIVE file; INCREMENTAL only those after the last completed backup (first one runs as FULL)", async () => {
    await makeStorage({ bucket: "pub" });
    await makeStorage({ bucket: "priv", access: "PRIVATE", prefix: "marino-private" });
    const a = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const cv = await uploadFile({ file: blob(PDF, "application/pdf"), name: "cv.pdf", folder: "cvs" });
    await db.file.updateMany({ data: { uploadedAt: new Date(Date.now() - 60_000) } });

    const first = await createBackup({ type: "INCREMENTAL", folder: null }, "u1");
    expect(first.backup.type).toBe("FULL");
    await first.done;
    const row = await db.fileBackup.findUniqueOrThrow({ where: { id: first.backup.id } });
    expect(row).toMatchObject({ status: "COMPLETED", fileCount: 2, error: null, createdBy: "u1" });
    expect(row.archiveKey).toMatch(/^marino\/_backups\/\d{4}-\d{2}-\d{2}_FULL_.+\.zip$/);

    // files across storages, manifest, zip64
    const zip = fake.get("pub", row.archiveKey!)!.body;
    expect(zip.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]))).toBe(true); // zip64 end of central directory
    const names = listZip(zip);
    expect(names).toEqual(["files/cvs/" + cv.id.slice(0, 8) + "_cv.pdf", "files/equipment/" + a.id.slice(0, 8) + "_a.png", "manifest.json"].sort());
    const manifest = JSON.parse(unzip(zip, "manifest.json"));
    expect(manifest).toMatchObject({ type: "FULL", fileCount: 2, totalSize: PNG.length + PDF.length, skipped: [] });
    expect(manifest.storages).toHaveLength(2);
    expect(unzip(zip, "files/cvs/" + cv.id.slice(0, 8) + "_cv.pdf")).toBe(PDF.toString());

    const b = await uploadFile({ file: blob(PNG, "image/png"), name: "b.png", folder: "products" });
    const inc = await createBackup({ type: "INCREMENTAL", folder: null }, "u1");
    expect(inc.backup.type).toBe("INCREMENTAL");
    await inc.done;
    const incRow = await db.fileBackup.findUniqueOrThrow({ where: { id: inc.backup.id } });
    expect(incRow.fileCount).toBe(1);
    expect(JSON.parse(unzip(fake.get("pub", incRow.archiveKey!)!.body, "manifest.json")).files.map((f: { id: string }) => f.id)).toEqual([b.id]);

    // DTO: BigInt → number; nothing left un-backed-up
    const list = await listBackups({ limit: 10 });
    expect(typeof list.items[0].totalSize).toBe("number");
    expect(list.notBackedUp.count).toBe(0);
  });

  it("BAK-R1 missing objects are skipped and listed; the backup still completes", async () => {
    await makeStorage({ bucket: "pub" });
    const a = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    await uploadFile({ file: blob(PNG, "image/png"), name: "b.png", folder: "equipment" });
    fake.buckets.get("pub")!.objects.delete(a.key);
    const r = await createBackup({ type: "FULL", folder: null }, null);
    await r.done;
    const row = await db.fileBackup.findUniqueOrThrow({ where: { id: r.backup.id } });
    expect(row).toMatchObject({ status: "COMPLETED", fileCount: 1, error: "1 file(s) skipped, see manifest.json" });
    expect(JSON.parse(unzip(fake.get("pub", row.archiveKey!)!.body, "manifest.json")).skipped).toEqual([{ id: a.id, key: a.key, reason: "NoSuchKey" }]);
  });

  it("BAK-R2 not while another job runs or a migration is unfinished", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const running = await jobs.startImport({ storageId: s.id, dryRun: true });
    await expect(createBackup({ type: "FULL", folder: null }, null)).rejects.toSatisfy((e) => isFilingError(e, "FILING_JOB_IN_PROGRESS"));
    await running.done;
    const ro = await makeStorage({ bucket: "ro", readOnly: true, active: false });
    await db.file.create({ data: { key: "marino/x.png", storageId: ro.id, name: "x", mimeType: "image/png", size: 1 } });
    await expect(createBackup({ type: "FULL", folder: null }, null)).rejects.toSatisfy((e) => isFilingError(e, "MIGRATION_NOT_FINISHED"));
  });

  it("BAK-R3 a publicly readable _backups/ sends archives to the private storage; none → refused", async () => {
    await makeStorage({ bucket: "allpub", publicRead: true });
    await expect(createBackup({ type: "FULL", folder: null }, null)).rejects.toSatisfy((e) => isFilingError(e, "BACKUP_NOT_READY"));
    const priv = await makeStorage({ bucket: "priv", access: "PRIVATE", prefix: "marino-private" });
    const r = await createBackup({ type: "FULL", folder: null }, null);
    await r.done;
    expect(r.backup.storageId).toBe(priv.id);
  });

  it("BAK-R4 download is a 5-minute presigned attachment; delete removes the archive then the row", async () => {
    await makeStorage({ bucket: "pub" });
    await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const r = await createBackup({ type: "FULL", folder: null }, null);
    const pendingErr = await downloadUrl(r.backup.id).catch((e) => e);
    await r.done;
    expect(isFilingError(pendingErr, "BACKUP_NOT_READY") || typeof pendingErr === "string").toBe(true);
    const url = await downloadUrl(r.backup.id);
    expect(url).toContain("X-Amz-Expires=300");
    expect(url).toContain("attachment");
    const key = r.backup.archiveKey!;
    await deleteBackup(r.backup.id);
    expect(fake.get("pub", key)).toBeNull();
    expect(await db.fileBackup.count()).toBe(0);
  });
});

// ======================= Migration =======================

const SRC = "src";
const DST = "dst";

async function seedFiles(storageId: string, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ key: `marino/2026/10/${String(i).padStart(5, "0")}-f.png`, storageId, name: `f${i}.png`, mimeType: "image/png", size: 4, folder: "equipment" }));
  for (const r of rows) seedObject(SRC, r.key, "data");
  await db.file.createMany({ data: rows });
  return db.file.findMany({ orderBy: { id: "asc" }, select: { id: true, key: true } });
}

async function seedReferences(keys: string[]) {
  const cats = [];
  for (let i = 0; i < 20; i++) {
    const c = await makeCategory();
    await db.category.update({ where: { id: c.id }, data: { image: `${base(SRC)}/${keys[i]}` } });
    cats.push(c.id);
  }
  const e = await makeEquipment();
  await db.equipment.update({ where: { id: e.id }, data: { images: [`${base(SRC)}/${keys[20]}`, "https://elsewhere.test/x.png", `${base(SRC)}/${keys[21]}`] } });
  const sr = await makeServiceRequest();
  await db.serviceRequest.update({ where: { id: sr.id }, data: { deliveryReport: `${base(SRC)}/${keys[22]}` } });
  return { cats, equipment: e.id, sr: sr.id };
}

async function prepare(n: number) {
  const source = await makeStorage({ bucket: SRC, name: "Old S3" });
  const target = await makeStorage({ bucket: DST, name: "New S3", active: false });
  const files = await seedFiles(source.id, n);
  const refs = await seedReferences(files.map((f) => f.key));
  await (await jobs.startCheck({ type: "DISCOVERY", dryRun: false })).done;
  return { source, target, files, refs };
}

const remainingOldRefs = async () => {
  let n = 0;
  for (const r of references()) n += await countWithBase(r, base(SRC));
  return n;
};

describe("migration", () => {
  it("precheck enforces same access and prefix, a passing target test, the image host, discovery and normalize", async () => {
    const { source, target } = await prepare(5);
    const ok = await jobs.migrationPrecheck({ sourceId: source.id, targetId: target.id });
    expect(ok.items.filter((i) => !i.ok).map((i) => i.id)).toEqual(["backup"]);
    expect(ok.ok).toBe(true);
    const priv = await makeStorage({ bucket: "p2", access: "PRIVATE", active: false });
    const other = await makeStorage({ bucket: "p3", prefix: "else", active: false });
    expect((await jobs.migrationPrecheck({ sourceId: source.id, targetId: priv.id })).items.find((i) => i.id === "access")?.ok).toBe(false);
    expect((await jobs.migrationPrecheck({ sourceId: source.id, targetId: other.id })).items.find((i) => i.id === "prefix")?.ok).toBe(false);
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = "";
    await expect(jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true })).rejects.toSatisfy((e) => isFilingError(e, "MIGRATION_PRECHECK_FAILED"));
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = "s3.test";
    await expect(jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: false })).rejects.toSatisfy((e) => isFilingError(e, "MIGRATION_PRECHECK_FAILED"));
  });

  it("1,000 files with uploads and deletes during the copy: zero downtime, conditional switch, swap, verification = 0", async () => {
    const { source, target, files, refs } = await prepare(1000);
    const copiedFirst = files[0];
    const notYetCopied = files[files.length - 1];
    const racing = files[500]; // deleted while its copy is being written to the target
    let reads = 0;
    let raced = false;
    const during: { uploaded?: string; checked?: boolean } = {};
    fake.hook = async (op, bucket, key) => {
      if (op === "PutObject" && bucket === DST && key === racing.key && !raced) {
        raced = true;
        await deleteFiles([racing.id]); // row still on the source: storage delete + DELETED
        return;
      }
      if (op !== "GetObject" || bucket !== SRC) return;
      reads++;
      if (reads !== 300) return;
      // Reads keep working during the copy: a stored source URL still resolves and is readable.
      during.checked = (await fetch(`${base(SRC)}/${notYetCopied.key}`)).status === 200;
      // A new upload goes to the target (already active).
      during.uploaded = (await uploadFile({ file: blob(PNG, "image/png"), name: "late.png", folder: "equipment" })).storageId;
      // Deletes: one already copied (row on target), one not yet copied (row on source).
      await deleteFiles([copiedFirst.id, notYetCopied.id]);
    };
    const job = await jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true });
    const report = (await job.done) as unknown as { finished: boolean; summary: Record<string, number> };
    fake.hook = null;
    expect(raced).toBe(true);
    expect(during).toEqual({ checked: true, uploaded: target.id });
    expect(fake.get(DST, racing.key)).toBeNull(); // conditional switch: the copy of a deleted file is dropped
    expect((await db.file.findUniqueOrThrow({ where: { id: racing.id } })).status).toBe("DELETED");
    expect(report.finished).toBe(true);
    expect(report.summary).toMatchObject({ missing: 0, failures: 0, remaining: 0, verification: 0 });
    expect(report.summary.copied).toBe(998); // copied-then-deleted counts; the racing and the not-yet-copied ones do not
    expect(await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } })).toBe(0);
    const active = await db.file.findMany({ where: { status: "ACTIVE" }, select: { key: true, storageId: true } });
    expect(active).toHaveLength(998);
    for (const f of active) {
      expect(f.storageId).toBe(target.id);
      expect(fake.get(DST, f.key)).not.toBeNull();
    }
    expect(fake.get(DST, copiedFirst.key)).toBeNull();
    expect(fake.get(DST, notYetCopied.key)).toBeNull();
    // every key read from the source at most once (nothing copied twice)
    const perKey = new Map<string, number>();
    for (const c of fake.calls) if (c.op === "GetObject" && c.bucket === SRC && !c.key.includes("/_system/")) perKey.set(c.key, (perKey.get(c.key) ?? 0) + 1);
    expect(Math.max(...perKey.values())).toBe(1);
    // references swapped, outside URLs untouched
    expect(await remainingOldRefs()).toBe(0);
    expect((await db.category.findUniqueOrThrow({ where: { id: refs.cats[1] } })).image).toBe(`${base(DST)}/${files[1].key}`);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: refs.equipment } })).images).toEqual([`${base(DST)}/${files[20].key}`, "https://elsewhere.test/x.png", `${base(DST)}/${files[21].key}`]);
    expect((await db.serviceRequest.findUniqueOrThrow({ where: { id: refs.sr } })).deliveryReport).toBe(`${base(DST)}/${files[22].key}`);
    // the source stays read-only and untouched (retention)
    const src = await db.fileStorage.findUniqueOrThrow({ where: { id: source.id } });
    expect(src).toMatchObject({ isActive: false, isReadOnly: true });
    expect(fake.get(SRC, files[5].key)).not.toBeNull();
  }, 120_000);

  it("crash during the copy, then resume: continues with the files left, nothing copied twice", async () => {
    const { source, target } = await prepare(300);
    const real = db.file.findMany.bind(db.file);
    let calls = 0;
    const spy = vi.spyOn(db.file, "findMany").mockImplementation(((args: Parameters<typeof db.file.findMany>[0]) => {
      if (args?.take === 200 && ++calls === 2) return Promise.reject(new Error("process killed (test)"));
      return real(args);
    }) as never);
    const job = await jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true });
    expect(await job.done).toBeNull();
    spy.mockRestore();
    expect(progress.get(job.jobId)?.phase).toBe("FAILED");
    const left = await db.file.count({ where: { storageId: source.id, status: "ACTIVE" } });
    expect(left).toBe(100);
    // Data-changing jobs wait for the migration.
    await expect(jobs.startCheck({ type: "NORMALIZE", dryRun: false })).rejects.toSatisfy((e) => isFilingError(e, "MIGRATION_NOT_FINISHED"));
    const resumed = (await (await jobs.resumeMigration({ sourceId: source.id })).done) as unknown as { finished: boolean; summary: Record<string, number> };
    expect(resumed.summary.copied).toBe(100);
    expect(resumed.finished).toBe(true);
    expect(resumed.summary.verification).toBe(0);
    const perKey = new Map<string, number>();
    for (const c of fake.calls) if (c.op === "GetObject" && c.bucket === SRC && !c.key.includes("/_system/")) perKey.set(c.key, (perKey.get(c.key) ?? 0) + 1);
    expect(perKey.size).toBe(300);
    expect(Math.max(...perKey.values())).toBe(1);
  }, 120_000);

  it("a missing object blocks the finish until marked deleted; then finish swaps with verification = 0", async () => {
    const { source, target, files } = await prepare(30);
    fake.buckets.get(SRC)!.objects.delete(files[29].key);
    const r = (await (await jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true })).done) as unknown as { finished: boolean; summary: Record<string, number>; missing: string[] };
    expect(r.finished).toBe(false);
    expect(r.summary).toMatchObject({ missing: 1, remaining: 1, verification: null });
    expect(r.missing).toEqual([files[29].key]);
    expect(await remainingOldRefs()).toBeGreaterThan(0); // no swap yet
    await expect((await jobs.finishMigration({ sourceId: source.id })).done).resolves.toBeNull(); // refused inside the job
    expect((await jobs.markMigrationMissing({ sourceId: source.id, keys: r.missing })).marked).toBe(1);
    const fin = (await (await jobs.finishMigration({ sourceId: source.id })).done) as unknown as { finished: boolean; summary: Record<string, number> };
    expect(fin).toMatchObject({ finished: true, summary: { verification: 0 } });
    expect(await remainingOldRefs()).toBe(0);
  }, 60_000);

  it("JOB-R4 purge after retention deletes only verified copies; then the old storage can be deleted; rollback by reverse migration", async () => {
    const { source, target, files, refs } = await prepare(40);
    await (await jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true })).done;

    // Rollback before purge: migrate back (target → source).
    await (await jobs.startCheck({ type: "DISCOVERY", dryRun: false })).done;
    const back = await jobs.migrationPrecheck({ sourceId: target.id, targetId: source.id });
    expect(back.items.filter((i) => !i.ok && !i.skippable)).toEqual([]);
    const late = await uploadFile({ file: blob(PNG, "image/png"), name: "after.png", folder: "equipment" }); // on target
    const rb = (await (await jobs.startMigration({ sourceId: target.id, targetId: source.id, skipBackup: true })).done) as unknown as { finished: boolean };
    expect(rb.finished).toBe(true);
    expect((await db.category.findUniqueOrThrow({ where: { id: refs.cats[0] } })).image).toBe(`${base(SRC)}/${files[0].key}`);
    expect(fake.get(SRC, late.key)).not.toBeNull();

    // Forward again, then purge the old one.
    await (await jobs.startCheck({ type: "DISCOVERY", dryRun: false })).done;
    await (await jobs.startMigration({ sourceId: source.id, targetId: target.id, skipBackup: true })).done;
    seedObject(SRC, "marino/stray-no-copy.png");
    await expect(jobs.startPurge({ sourceId: source.id, confirmName: "wrong", deleteBackups: false })).rejects.toThrow(/Type the storage name/);
    expect(await (await jobs.startPurge({ sourceId: source.id, confirmName: "Old S3", deleteBackups: false })).done).toBeNull(); // retention
    await db.$executeRawUnsafe(`UPDATE "FileStorage" SET "updatedAt" = now() - interval '31 days' WHERE id = $1`, source.id);
    invalidateStorages();
    const purge = (await (await jobs.startPurge({ sourceId: source.id, confirmName: "Old S3", deleteBackups: false })).done) as unknown as { summary: Record<string, number>; kept: { key: string }[] };
    expect(purge.kept.map((k) => k.key)).toEqual(["marino/stray-no-copy.png"]);
    expect(purge.summary.deleted).toBeGreaterThanOrEqual(41); // 40 files + the rollback upload + job reports
    expect([...fake.buckets.get(SRC)!.objects.keys()]).toEqual(["marino/stray-no-copy.png"]);
    expect(fake.get(DST, late.key)).not.toBeNull();
    expect(fake.get(SRC, files[3].key)).toBeNull();
    expect(fake.get(DST, files[3].key)).not.toBeNull();
    await deleteStorage(source.id, "Old S3");
    expect(await db.fileStorage.count()).toBe(1);
  }, 120_000);
});
