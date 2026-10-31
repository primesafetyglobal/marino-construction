// FILE SERVICE: the registry of every stored file (guide §5).
//
// Permission-free: called by this module's actions (which check permissions)
// and, through lib/index.ts, by other modules (which apply their own rules).
//
// Rules:
// - FIL-R1  keys are {prefix}/{yyyy}/{mm}/{uuid}-{safe-name}.{ext}, chosen by the server
// - FIL-R2  upload policy: type and size from the folder rule (inherited) capped by the
//           global limit; PRIVATE folders go to the active PRIVATE storage
// - FIL-R3  server uploads check magic bytes; a failed DB write removes the object
// - FIL-R4  confirmUpload re-checks the real type and size from storage, accepts only
//           keys of the storage it issued, and is idempotent
// - FIL-R5  the stored value of other modules is the computed `url`; any known format
//           (base variants, query strings, legacyUrl) resolves back to the file
// - FIL-R6  private files open through short presigned URLs (LRU cache), never stored
// - FIL-R7  delete removes the object first; a failed storage delete leaves the row ACTIVE
// - FIL-R8  moving into a folder whose rule does not fit a file (type, size, access) is refused
// - FIL-R9  deleteByUrl never throws for external URLs

import "server-only";
import { randomUUID } from "node:crypto";
import { LRUCache } from "lru-cache";
import mime from "mime-types";
import { db, Prisma } from "@/server/validation/db";
import { pageArgs, toPage, type Page } from "@/server/validation/pagination";
import { FilingError } from "../lib/errors";
import { normalizeFolder, ruleFor, UNFILED } from "../lib/folder";
import { countUsage } from "../lib/references/usage";
import { getSettings } from "../lib/settings";
import * as ops from "../lib/storage/ops";
import { activeStorage, getStorage, storages, type Access, type LoadedStorage } from "../lib/storage/registry";
import { cleanUrl, isOwnKey, parseUrl } from "../lib/storage/urls";
import type { ListFilesData } from "./file.schema";
import { fileSelect, toFileDto, type FileDto, type FileRow } from "./file.select";

// ======================= Keys and policy =======================

// FIL-R1.
export function newKey(s: Pick<LoadedStorage, "prefix">, originalName: string, now = new Date()) {
  const dot = originalName.lastIndexOf(".");
  const ext = dot > 0 ? originalName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) : "";
  const base =
    (dot > 0 ? originalName.slice(0, dot) : originalName)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // "été" → "ete", not "e-te"
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "file";
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${s.prefix}/${now.getUTCFullYear()}/${mm}/${randomUUID()}-${base}${ext ? "." + ext : ""}`;
}

// FIL-R2.
export async function uploadPolicy(folderIn: string | null | undefined, mimeType: string, size: number) {
  const st = await getSettings();
  const folder = normalizeFolder(folderIn);
  const rule = ruleFor(folder, st.folderRules);
  const types = rule?.mimeTypes ?? st.allowedMimeTypes;
  const maxBytes = Math.min(rule?.maxMb ?? st.maxUploadMb, st.maxUploadMb) * 1024 * 1024;
  if (!types.includes(mimeType)) throw new FilingError("FILE_TYPE_NOT_ALLOWED", `Files of type ${mimeType} are not allowed here.`);
  if (size > maxBytes) throw new FilingError("FILE_TOO_LARGE", `The maximum size here is ${Math.round(maxBytes / 1048576)} MB.`);
  const access: Access = rule?.access ?? "PUBLIC";
  const storage = await activeStorage(access);
  return { folder, storage, access };
}

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")),
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

// FIL-R3.
export function assertMagicBytes(mimeType: string, body: Buffer) {
  const check = SIGNATURES[mimeType];
  if (check && !check(body)) throw new FilingError("FILE_CONTENT_MISMATCH", "The file content does not match its type.");
}

const cacheControlFor = (s: Pick<LoadedStorage, "access">) => (s.access === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store");

const lookupType = (name: string) => mime.lookup(name) || "application/octet-stream";

// ======================= Uploads =======================

// FIL-R2, FIL-R3: server upload (small files).
export async function uploadFile(input: { file: Blob; name: string; folder?: string | null }): Promise<FileDto> {
  const mimeType = input.file.type || lookupType(input.name);
  const { folder, storage } = await uploadPolicy(input.folder, mimeType, input.file.size);
  const body = Buffer.from(await input.file.arrayBuffer());
  assertMagicBytes(mimeType, body);
  const key = newKey(storage, input.name);
  await ops.put(storage, key, body, mimeType, cacheControlFor(storage));
  try {
    const f = await db.file.create({ data: { key, storageId: storage.id, name: input.name, mimeType, size: body.length, folder }, select: fileSelect });
    return toFileDto(f, storage);
  } catch (e) {
    await ops.remove(storage, key).catch(() => {});
    throw e;
  }
}

// FIL-R1, FIL-R2: presigned PUT for browser uploads.
export async function requestUpload(input: { name: string; mimeType: string; size: number; folder?: string | null }) {
  const { storage, folder } = await uploadPolicy(input.folder, input.mimeType, input.size);
  const { presignExpirySec } = await getSettings();
  const key = newKey(storage, input.name);
  const uploadUrl = await ops.presignPut(storage, key, input.mimeType, input.size, presignExpirySec);
  return { key, storageId: storage.id, folder, uploadUrl, headers: { "Content-Type": input.mimeType }, expiresAt: Date.now() + presignExpirySec * 1000 };
}

export type UploadTicket = Awaited<ReturnType<typeof requestUpload>>;

// FIL-R4: register after the browser upload.
export async function confirmUpload(input: { key: string; storageId: string; name: string; folder?: string | null }): Promise<FileDto> {
  const storage = await getStorage(input.storageId);
  if (!isOwnKey(storage, input.key)) throw new FilingError("FILE_KEY_INVALID", "Invalid file reference.");
  const existing = await db.file.findUnique({ where: { key: input.key }, select: fileSelect });
  if (existing) {
    if (existing.storageId !== storage.id || existing.status !== "ACTIVE") throw new FilingError("FILE_KEY_INVALID", "Invalid file reference.");
    return toFileDto(existing, storage);
  }
  const h = await ops.head(storage, input.key);
  if (!h) throw new FilingError("FILE_NOT_IN_STORAGE", "The upload did not complete. Please try again.");
  const mimeType = h.contentType ?? lookupType(input.name);
  const policy = await uploadPolicy(input.folder, mimeType, h.size).catch(async (e) => {
    await ops.remove(storage, input.key).catch(() => {});
    throw e;
  });
  if (policy.storage.id !== storage.id) {
    await ops.remove(storage, input.key).catch(() => {});
    throw new FilingError("FILE_KEY_INVALID", "Wrong storage for this folder.");
  }
  const f = await db.file.upsert({
    where: { key: input.key },
    update: {},
    create: { key: input.key, storageId: storage.id, name: input.name, mimeType, size: h.size, folder: policy.folder },
    select: fileSelect,
  });
  return toFileDto(f, storage);
}

// ======================= Lookup =======================

async function dto(f: FileRow): Promise<FileDto> {
  return toFileDto(f, await getStorage(f.storageId));
}

export async function getFile(id: string): Promise<FileDto | null> {
  const f = await db.file.findUnique({ where: { id }, select: fileSelect });
  return f ? dto(f) : null;
}

// FIL-R5.
export async function getFileByUrl(url: string | null | undefined): Promise<FileDto | null> {
  if (!url) return null;
  const parsed = await parseUrl(url);
  if (parsed) {
    const f = await db.file.findUnique({ where: { key: parsed.key }, select: fileSelect });
    if (f) return dto(f);
  }
  const legacy = await db.file.findUnique({ where: { legacyUrl: cleanUrl(url) }, select: fileSelect });
  return legacy ? dto(legacy) : null;
}

// ======================= Access (FIL-R6) =======================

const presigned = new LRUCache<string, { url: string; exp: number }>({ max: 5000 });

export const invalidatePresign = (key: string) => {
  for (const k of presigned.keys()) if (k.includes(`:${key}:`)) presigned.delete(k);
};

export async function presignCached(s: LoadedStorage, key: string, downloadName?: string, expiresIn?: number): Promise<string> {
  const ttl = expiresIn ?? (await getSettings()).presignExpirySec;
  const cacheKey = `${s.id}:${key}:${downloadName ?? ""}`;
  const hit = presigned.get(cacheKey);
  if (hit && hit.exp - Date.now() >= 60_000) return hit.url;
  const url = await ops.presignGet(s, key, ttl, downloadName);
  presigned.set(cacheKey, { url, exp: Date.now() + ttl * 1000 });
  return url;
}

async function accessFor(f: FileDto, opts?: { download?: boolean }): Promise<string | null> {
  if (f.status !== "ACTIVE") return null;
  const s = await getStorage(f.storageId);
  if (s.access === "PUBLIC" && !opts?.download) return f.url;
  return presignCached(s, f.key, opts?.download ? f.name : undefined);
}

/** Public → current URL. Private → presigned (cached). External → unchanged. Deleted → null. */
export async function getAccessUrl(url: string | null | undefined, opts?: { download?: boolean }): Promise<string | null> {
  if (!url) return null;
  const f = await getFileByUrl(url);
  if (!f) return url;
  return accessFor(f, opts);
}

/** Batch version: one query for all registered URLs. Same order as the input. */
export async function getAccessUrls(urls: (string | null | undefined)[], opts?: { download?: boolean }): Promise<(string | null)[]> {
  const parsed = await Promise.all(urls.map(async (u) => (u ? await parseUrl(u) : null)));
  const keys = [...new Set(parsed.flatMap((p) => (p ? [p.key] : [])))];
  const cleaned = [...new Set(urls.flatMap((u, i) => (u && !parsed[i] ? [cleanUrl(u)] : [])))];
  const rows = keys.length || cleaned.length
    ? await db.file.findMany({ where: { OR: [{ key: { in: keys } }, { legacyUrl: { in: cleaned } }] }, select: { ...fileSelect, legacyUrl: true } })
    : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const byLegacy = new Map(rows.filter((r) => r.legacyUrl).map((r) => [r.legacyUrl!, r]));
  return Promise.all(
    urls.map(async (u, i) => {
      if (!u) return null;
      const p = parsed[i];
      const row = (p && byKey.get(p.key)) || byLegacy.get(cleanUrl(u));
      if (!row) return u;
      const { legacyUrl: _legacy, ...f } = row;
      void _legacy;
      return accessFor(await dto(f), opts);
    }),
  );
}

export async function getAccessUrlById(id: string, opts?: { download?: boolean }): Promise<string> {
  const f = await getFile(id);
  if (!f) throw new FilingError("FILE_NOT_FOUND", "File not found.");
  const url = await accessFor(f, opts);
  if (!url) throw new FilingError("FILE_NOT_FOUND", "This file was deleted.");
  return url;
}

// ======================= Delete (FIL-R7, FIL-R9) =======================

// Guide §10.3: a delete that read the source storage while the copy switched the
// row to the target leaves a copy there. Remove it too.
async function removeMigrationCopyIfAny(f: { key: string; storageId: string }) {
  const s = await getStorage(f.storageId);
  if (!s.isReadOnly) return;
  for (const t of (await storages()).values()) {
    if (t.id !== s.id && t.access === s.access && t.isActive && !t.isReadOnly) await ops.remove(t, f.key);
  }
}

export async function deleteFiles(ids: string[]): Promise<{ deleted: number; failed: { id: string; reason: string }[] }> {
  const files = await db.file.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, key: true, storageId: true } });
  const failed: { id: string; reason: string }[] = [];
  let deleted = 0;
  for (const f of files) {
    try {
      const s = await getStorage(f.storageId);
      await ops.remove(s, f.key);
      // The row may have switched storage while we deleted (migration copy): read it again.
      const after = await db.file.findUnique({ where: { id: f.id }, select: { storageId: true } });
      if (after && after.storageId !== f.storageId) await ops.remove(await getStorage(after.storageId), f.key);
      await db.file.update({ where: { id: f.id }, data: { status: "DELETED", deletedAt: new Date() } });
      await removeMigrationCopyIfAny(f);
      invalidatePresign(f.key);
      deleted++;
    } catch (e) {
      failed.push({ id: f.id, reason: (e as Error)?.message ?? "Delete failed" });
    }
  }
  return { deleted, failed };
}

export async function deleteByUrl(url: string | null | undefined): Promise<{ deleted: number; failed: { id: string; reason: string }[] }> {
  if (!url) return { deleted: 0, failed: [] };
  const f = await getFileByUrl(url).catch(() => null);
  if (f) return f.status === "ACTIVE" ? deleteFiles([f.id]) : { deleted: 0, failed: [] };
  const p = await parseUrl(url).catch(() => null);
  if (p && isOwnKey(p.storage, p.key) && !p.storage.isReadOnly) {
    await ops.remove(p.storage, p.key);
    return { deleted: 1, failed: [] };
  }
  return { deleted: 0, failed: [] };
}

export async function replaceFile(oldUrl: string | null | undefined, input: Parameters<typeof uploadFile>[0]): Promise<FileDto> {
  const created = await uploadFile(input);
  await deleteByUrl(oldUrl).catch((e) => console.error("[filing] old file cleanup failed", e));
  return created;
}

// ======================= Organize (database only) =======================

// FIL-R8.
async function assertMoveAllowed(ids: string[], folder: string | null) {
  const st = await getSettings();
  const rule = ruleFor(folder, st.folderRules);
  const types = rule?.mimeTypes ?? st.allowedMimeTypes;
  const maxBytes = Math.min(rule?.maxMb ?? st.maxUploadMb, st.maxUploadMb) * 1024 * 1024;
  const access: Access = rule?.access ?? "PUBLIC";
  const all = await storages();
  const files = await db.file.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { name: true, mimeType: true, size: true, storageId: true } });
  const bad = files.filter((f) => !types.includes(f.mimeType) || f.size > maxBytes || all.get(f.storageId)?.access !== access);
  if (bad.length) {
    const names = bad.slice(0, 3).map((f) => f.name).join(", ");
    throw new FilingError("FILE_MOVE_NOT_ALLOWED", `${bad.length} file(s) do not fit the rules of this folder (${names}${bad.length > 3 ? ", …" : ""}). Upload them again there instead.`);
  }
}

export async function moveFiles(ids: string[], folderIn: string | null | undefined): Promise<{ moved: number }> {
  const folder = normalizeFolder(folderIn);
  await assertMoveAllowed(ids, folder);
  const res = await db.file.updateMany({ where: { id: { in: ids }, status: "ACTIVE" }, data: { folder } });
  return { moved: res.count };
}

export async function renameFile(id: string, name: string): Promise<FileDto> {
  const exists = await db.file.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new FilingError("FILE_NOT_FOUND", "File not found.");
  return dto(await db.file.update({ where: { id }, data: { name }, select: fileSelect }));
}

// Renames a folder and its sub-folders. Guide §5.4: one parameterized statement.
export async function renameFolder(from: string, to: string): Promise<{ renamed: number }> {
  const renamed = await db.$executeRaw`
    UPDATE "File" SET folder = ${to}::text || substring(folder FROM ${from.length + 1}::int)
    WHERE folder = ${from}::text OR folder LIKE ${from + "/%"}::text`;
  return { renamed };
}

// ======================= Reads (admin) =======================

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const typeWhere = (type: "image" | "document" | "other"): Prisma.FileWhereInput =>
  type === "image"
    ? { mimeType: { startsWith: "image/" } }
    : type === "document"
      ? { OR: [{ mimeType: { in: DOCUMENT_TYPES } }, { mimeType: { startsWith: "text/" } }] }
      : { NOT: [{ mimeType: { startsWith: "image/" } }, { mimeType: { in: DOCUMENT_TYPES } }, { mimeType: { startsWith: "text/" } }] };

const typeOf = (mimeType: string): "image" | "document" | "other" =>
  mimeType.startsWith("image/") ? "image" : DOCUMENT_TYPES.includes(mimeType) || mimeType.startsWith("text/") ? "document" : "other";

export async function listFiles(query: ListFilesData): Promise<Page<FileDto>> {
  const folder = query.folder === UNFILED ? UNFILED : normalizeFolder(query.folder);
  const where: Prisma.FileWhereInput = {
    status: query.status ?? "ACTIVE",
    ...(folder === UNFILED ? { folder: null } : folder ? { OR: [{ folder }, { folder: { startsWith: `${folder}/` } }] } : {}),
    ...(query.storageId ? { storageId: query.storageId } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
    ...(query.from || query.to ? { uploadedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    ...(query.type ? { AND: [typeWhere(query.type)] } : {}),
  };
  const sort = query.sort ?? "uploadedAt";
  const dir = query.dir ?? (sort === "name" ? "asc" : "desc");
  const rows = await db.file.findMany({ where, orderBy: [{ [sort]: dir }, { id: dir }], select: fileSelect, ...pageArgs(query) });
  const all = await storages();
  const page = toPage(rows, query.limit);
  return { ...page, items: page.items.map((f) => toFileDto(f, all.get(f.storageId)!)) };
}

export async function listFolders(): Promise<{ folder: string | null; count: number; size: number }[]> {
  const groups = await db.file.groupBy({ by: ["folder"], where: { status: "ACTIVE" }, _count: { _all: true }, _sum: { size: true }, orderBy: { folder: "asc" } });
  return groups.map((g) => ({ folder: g.folder, count: g._count._all, size: g._sum.size ?? 0 }));
}

export type FileStats = {
  active: { count: number; size: number };
  deleted: number;
  byType: { type: string; count: number; size: number }[];
  byStorage: { storageId: string; name: string; count: number; size: number }[];
  perMonth: { month: string; count: number; size: number }[];
};

let statsCache: { at: number; value: FileStats } | null = null;

export async function getStats(): Promise<FileStats> {
  if (statsCache && Date.now() - statsCache.at < 60_000) return statsCache.value;
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)));
  const [active, deleted, byMime, byStorage, perMonth, all] = await Promise.all([
    db.file.aggregate({ where: { status: "ACTIVE" }, _count: { _all: true }, _sum: { size: true } }),
    db.file.count({ where: { status: "DELETED" } }),
    db.file.groupBy({ by: ["mimeType"], where: { status: "ACTIVE" }, _count: { _all: true }, _sum: { size: true } }),
    db.file.groupBy({ by: ["storageId"], where: { status: "ACTIVE" }, _count: { _all: true }, _sum: { size: true } }),
    Promise.all(
      months.map((m, i) => {
        const end = i < 11 ? months[i + 1] : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        return db.file.aggregate({ where: { uploadedAt: { gte: m, lt: end } }, _count: { _all: true }, _sum: { size: true } });
      }),
    ),
    storages().catch(() => new Map<string, LoadedStorage>()),
  ]);
  const types = new Map<string, { count: number; size: number }>();
  for (const g of byMime) {
    const t = types.get(typeOf(g.mimeType)) ?? { count: 0, size: 0 };
    t.count += g._count._all;
    t.size += g._sum.size ?? 0;
    types.set(typeOf(g.mimeType), t);
  }
  const value: FileStats = {
    active: { count: active._count._all, size: active._sum.size ?? 0 },
    deleted,
    byType: [...types].map(([type, v]) => ({ type, ...v })),
    byStorage: byStorage.map((g) => ({ storageId: g.storageId, name: all.get(g.storageId)?.name ?? g.storageId, count: g._count._all, size: g._sum.size ?? 0 })),
    perMonth: perMonth.map((a, i) => ({ month: months[i].toISOString().slice(0, 7), count: a._count._all, size: a._sum.size ?? 0 })),
  };
  statsCache = { at: Date.now(), value };
  return value;
}

export const invalidateStats = () => {
  statsCache = null;
};

/** Where one file is used (preview drawer, delete dialog). */
export async function fileUsage(id: string) {
  const f = await db.file.findUnique({ where: { id }, select: { ...fileSelect, legacyUrl: true } });
  if (!f) throw new FilingError("FILE_NOT_FOUND", "File not found.");
  const s = await getStorage(f.storageId);
  const { legacyUrl, ...row } = f;
  const urls = [toFileDto(row, s).url, ...(legacyUrl ? [legacyUrl] : [])];
  return countUsage(urls);
}
