// FILE STORAGE SERVICE: S3-compatible storages, credentials encrypted at rest (guide §6).
//
// Rules:
// - STO-R1  secretAccessKey is encrypted, write-only, never returned or logged
// - STO-R2  bucket, prefix, endpoint, region, forcePathStyle and access are locked once
//           the storage has files (create a new storage and migrate instead)
// - STO-R3  at most one active storage per access; activation needs a passing test and is
//           allowed directly only while the current active one of that access has no files
// - STO-R4  delete only with no file and no backup pointing to it
// - STO-R5  publicBaseUrl changes only through the base-URL change job (§8.6)

import "server-only";
import { Errors } from "@/server/core/errors";
import { db } from "@/server/validation/db";
import { encrypt } from "../lib/crypto";
import { FilingError } from "../lib/errors";
import { writeReport } from "../lib/reports";
import { getStorage, invalidateStorages, makeClient, type LoadedStorage } from "../lib/storage/registry";
import { testStorage, type TestReport } from "../lib/storage/test";
import type { CreateStorageData, UpdateStorageData } from "./file-storage.schema";
import { storageSelect, toStorageDto, type StorageDto } from "./file-storage.select";

// Last test per storage, in process memory (the full report is in storage, §1.2).
const lastTests = new Map<string, TestReport>();

const LOCKED = ["bucket", "prefix", "endpoint", "region", "forcePathStyle", "access"] as const;

// ======================= Reads =======================

export async function listStorages(): Promise<StorageDto[]> {
  const [rows, backups] = await Promise.all([
    db.fileStorage.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }], select: storageSelect }),
    db.fileBackup.groupBy({ by: ["storageId"], _count: { _all: true } }),
  ]);
  const b = new Map(backups.map((g) => [g.storageId, g._count._all]));
  return rows.map((r) => toStorageDto(r, { backups: b.get(r.id) ?? 0, lastTest: lastTests.get(r.id) ?? null }));
}

export async function getStorageDto(id: string): Promise<StorageDto> {
  const [r, backups] = await Promise.all([
    db.fileStorage.findUnique({ where: { id }, select: storageSelect }),
    db.fileBackup.count({ where: { storageId: id } }),
  ]);
  if (!r) throw new FilingError("STORAGE_NOT_FOUND", "Storage not found.");
  return toStorageDto(r, { backups, lastTest: lastTests.get(id) ?? null });
}

// ======================= Test =======================

type Candidate = Omit<LoadedStorage, "client" | "updatedAt" | "isActive" | "isReadOnly"> & { secret: string };

const asTestable = (c: Candidate) => ({
  ...c,
  client: makeClient({ region: c.region, endpoint: c.endpoint, forcePathStyle: c.forcePathStyle, accessKeyId: c.accessKeyId, secret: c.secret }),
});

async function record(id: string, report: TestReport): Promise<TestReport> {
  lastTests.set(id, report);
  await writeReport("STORAGE_TEST", id, report).catch(() => {}); // no active storage yet: in memory only
  return report;
}

export async function testStorageById(id: string, opts?: { publicBaseUrl?: string | null }): Promise<TestReport> {
  const s = await getStorage(id);
  const report = await testStorage(opts && "publicBaseUrl" in opts ? { ...s, publicBaseUrl: opts.publicBaseUrl ?? null } : s);
  return record(id, report);
}

// ======================= Writes =======================

// STO-R1: created inactive, then tested.
export async function createStorage(data: CreateStorageData): Promise<{ storage: StorageDto; test: TestReport }> {
  const clash = await db.fileStorage.findFirst({ where: { bucket: data.bucket, prefix: data.prefix, endpoint: data.endpoint }, select: { id: true } });
  if (clash) throw new FilingError("STORAGE_IN_USE", "Another storage already uses this bucket and prefix. Never share a prefix.", { prefix: ["Choose another prefix."] });
  const created = await db.fileStorage.create({
    data: {
      name: data.name,
      endpoint: data.endpoint,
      region: data.region,
      bucket: data.bucket,
      prefix: data.prefix,
      forcePathStyle: data.forcePathStyle,
      accessKeyId: data.accessKeyId,
      secretAccessKey: encrypt(data.secretAccessKey),
      publicBaseUrl: data.publicBaseUrl,
      access: data.access,
      isActive: false,
    },
    select: { id: true },
  });
  invalidateStorages();
  const test = await record(created.id, await testStorage(asTestable({ id: created.id, ...data, secret: data.secretAccessKey })));
  return { storage: await getStorageDto(created.id), test };
}

// STO-R1, STO-R2.
export async function updateStorage(data: UpdateStorageData): Promise<{ storage: StorageDto; test: TestReport }> {
  const current = await db.fileStorage.findUnique({ where: { id: data.id }, select: { id: true, bucket: true, prefix: true, endpoint: true, region: true, forcePathStyle: true, access: true } });
  if (!current) throw new FilingError("STORAGE_NOT_FOUND", "Storage not found.");
  const changedLocked = LOCKED.filter((f) => data[f] !== undefined && data[f] !== current[f]);
  if (changedLocked.length) {
    const files = await db.file.count({ where: { storageId: data.id } });
    if (files > 0) {
      throw new FilingError(
        "STORAGE_LOCKED_FIELDS",
        "These fields cannot change while the storage has files. Create a new storage and migrate instead.",
        Object.fromEntries(changedLocked.map((f) => [f, ["Locked: the storage has files."]])),
      );
    }
  }
  await db.fileStorage.update({
    where: { id: data.id },
    data: {
      name: data.name,
      endpoint: data.endpoint,
      region: data.region,
      bucket: data.bucket,
      prefix: data.prefix,
      forcePathStyle: data.forcePathStyle,
      accessKeyId: data.accessKeyId,
      access: data.access,
      ...(data.secretAccessKey ? { secretAccessKey: encrypt(data.secretAccessKey) } : {}),
    },
  });
  invalidateStorages();
  const test = await testStorageById(data.id);
  return { storage: await getStorageDto(data.id), test };
}

// STO-R3.
export async function activateStorage(id: string): Promise<StorageDto> {
  const s = await getStorage(id);
  if (s.isReadOnly) throw new FilingError("STORAGE_READ_ONLY", "A read-only storage cannot be activated.");
  if (s.isActive) return getStorageDto(id);
  const test = await testStorageById(id);
  if (!test.ok) throw new FilingError("STORAGE_TEST_FAILED", "The storage test failed. Fix the problems shown in the test report first.");
  await db.$transaction(async (tx) => {
    const others = await tx.fileStorage.findMany({ where: { access: s.access, isActive: true, id: { not: id } }, select: { id: true, _count: { select: { files: { where: { status: "ACTIVE" } } } } } });
    if (others.some((o) => o._count.files > 0)) {
      throw new FilingError("STORAGE_IN_USE", `The active ${s.access.toLowerCase()} storage has files. Use Migrate to move them to this storage.`);
    }
    await tx.fileStorage.updateMany({ where: { access: s.access, isActive: true, id: { not: id } }, data: { isActive: false } });
    await tx.fileStorage.update({ where: { id }, data: { isActive: true } });
  });
  invalidateStorages();
  return getStorageDto(id);
}

// STO-R4.
export async function deleteStorage(id: string, confirmName: string): Promise<{ id: string }> {
  const s = await db.fileStorage.findUnique({ where: { id }, select: { name: true, _count: { select: { files: true } } } });
  if (!s) throw new FilingError("STORAGE_NOT_FOUND", "Storage not found.");
  if (confirmName !== s.name) throw Errors.invalid("Type the storage name exactly to confirm.", { confirmName: ["Does not match."] });
  const backups = await db.fileBackup.count({ where: { storageId: id } });
  if (s._count.files > 0 || backups > 0) {
    throw new FilingError("STORAGE_IN_USE", `This storage still has ${s._count.files} file record(s) and ${backups} backup(s). Purge it first.`);
  }
  await db.fileStorage.delete({ where: { id } });
  lastTests.delete(id);
  invalidateStorages();
  return { id };
}

/** Tests only. */
export const resetStorageTests = () => lastTests.clear();
