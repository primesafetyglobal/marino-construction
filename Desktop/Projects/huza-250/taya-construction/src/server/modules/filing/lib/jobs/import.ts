// IMPORT (guide §8.1): registers existing objects of a storage. Lists the
// prefix (skipping _backups/, _system/ and placeholders) and creates a File for
// each unregistered key, in batches of 500 with skipDuplicates; re-runnable.
// Values in declared references that resolve to a file but differ from its
// canonical URL are kept in legacyUrl (first one found). Unreferenced objects
// older than 24 h are flagged as possibly abandoned uploads.

import mime from "mime-types";
import { db } from "@/server/validation/db";
import { FOLDER_REGEX, normalizeFolder } from "../folder";
import { progress } from "../progress";
import { extractUrls } from "../references/extract";
import { references } from "../references/registry";
import * as ops from "../storage/ops";
import { getStorage, type LoadedStorage } from "../storage/registry";
import { buildUrl, cleanUrl, isOwnKey, parseWith } from "../storage/urls";
import { allBases, cap } from "./common";
import { sleep } from "./run";

type Obj = { key: string; size: number; lastModified: Date | null };
type RefInfo = { folder: string | null; legacy: string | null; referenced: boolean };

const BATCH = 500;
const DAY = 24 * 60 * 60 * 1000;

/** key → first declared folder, first non-canonical value, referenced flag. */
export async function referenceMap(s: LoadedStorage): Promise<Map<string, RefInfo>> {
  const map = new Map<string, RefInfo>();
  const bases = await allBases([s]);
  for (const ref of references()) {
    for await (const { url } of extractUrls(ref, bases)) {
      const clean = cleanUrl(url);
      const key = parseWith(s, clean);
      if (!key) continue;
      const info = map.get(key) ?? { folder: null, legacy: null, referenced: true };
      if (!info.folder && ref.folder) info.folder = ref.folder;
      if (!info.legacy && clean !== buildUrl(s, key)) info.legacy = clean;
      map.set(key, info);
    }
  }
  return map;
}

/** Folder from the key's sub-path inside the prefix ("marino/catalog/equipment/x.jpg" → "catalog/equipment"). */
export function folderFromKey(s: Pick<LoadedStorage, "prefix">, key: string): string | null {
  const rest = key.slice(s.prefix.length + 1);
  const dir = rest.includes("/") ? rest.slice(0, rest.lastIndexOf("/")) : "";
  if (!dir || /^\d{4}\/\d{2}$/.test(dir)) return null; // Filing's own yyyy/mm layout
  const f = normalizeFolder(dir);
  return f && FOLDER_REGEX.test(f) ? f : null;
}

const nameOf = (key: string) => {
  const last = key.slice(key.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last) || "file";
  } catch {
    return last || "file";
  }
};

/** Registers the given objects (skips registered keys and taken legacy URLs). Returns created count. */
export async function registerObjects(s: LoadedStorage, objs: Obj[], refs: Map<string, RefInfo>, dryRun: boolean): Promise<{ created: number; legacy: number }> {
  if (!objs.length) return { created: 0, legacy: 0 };
  const keys = objs.map((o) => o.key);
  const existing = new Set((await db.file.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((f) => f.key));
  const fresh = objs.filter((o) => !existing.has(o.key));
  const legacyWanted = fresh.flatMap((o) => (refs.get(o.key)?.legacy ? [refs.get(o.key)!.legacy!] : []));
  const takenLegacy = new Set(
    legacyWanted.length ? (await db.file.findMany({ where: { legacyUrl: { in: legacyWanted } }, select: { legacyUrl: true } })).map((f) => f.legacyUrl!) : [],
  );
  const data = fresh.map((o) => {
    const info = refs.get(o.key);
    const legacy = info?.legacy && !takenLegacy.has(info.legacy) ? info.legacy : null;
    if (legacy) takenLegacy.add(legacy);
    const name = nameOf(o.key);
    return {
      key: o.key,
      storageId: s.id,
      name,
      mimeType: mime.lookup(name) || "application/octet-stream",
      size: o.size,
      folder: info?.folder ?? folderFromKey(s, o.key),
      legacyUrl: legacy,
      uploadedAt: o.lastModified ?? new Date(),
    };
  });
  if (dryRun) return { created: data.length, legacy: data.filter((d) => d.legacyUrl).length };
  const res = await db.file.createMany({ data, skipDuplicates: true });
  return { created: res.count, legacy: data.filter((d) => d.legacyUrl).length };
}

export async function runImport(jobId: string, opts: { storageId: string; dryRun: boolean }) {
  const s = await getStorage(opts.storageId);
  progress.set(jobId, { phase: "SCANNING REFERENCES" });
  const refs = await referenceMap(s);
  progress.set(jobId, { phase: opts.dryRun ? "DRY RUN" : "IMPORTING" });
  let listed = 0;
  let created = 0;
  let legacy = 0;
  const abandoned: { key: string; size: number; lastModified: string | null }[] = [];
  const registeredKeys = new Set<string>();
  let batch: Obj[] = [];
  const flush = async () => {
    const r = await registerObjects(s, batch, refs, opts.dryRun);
    created += r.created;
    legacy += r.legacy;
    progress.set(jobId, { done: listed });
    batch = [];
    await sleep(100);
  };
  for await (const o of ops.list(s, `${s.prefix}/`)) {
    if (!isOwnKey(s, o.key)) continue;
    listed++;
    registeredKeys.add(o.key);
    if (!refs.has(o.key) && o.lastModified && Date.now() - o.lastModified.getTime() > DAY) {
      abandoned.push({ key: o.key, size: o.size, lastModified: o.lastModified.toISOString() });
    }
    batch.push(o);
    if (batch.length >= BATCH) await flush();
  }
  if (batch.length) await flush();
  // Existing rows without a legacy URL get the first non-canonical value found.
  let legacyUpdated = 0;
  if (!opts.dryRun) {
    for (const [key, info] of refs) {
      if (!info.legacy) continue;
      const taken = await db.file.findUnique({ where: { legacyUrl: info.legacy }, select: { id: true } });
      if (taken) continue;
      const res = await db.file.updateMany({ where: { key, legacyUrl: null }, data: { legacyUrl: info.legacy } });
      legacyUpdated += res.count;
    }
  }
  const referencedNotInStorage = [...refs.keys()].filter((k) => !registeredKeys.has(k));
  return {
    storageId: s.id,
    summary: { listed, created, legacyUrls: legacy + legacyUpdated, abandoned: abandoned.length, referencedButMissing: referencedNotInStorage.length },
    abandoned: cap(abandoned, 100_000),
    referencedButMissing: cap(referencedNotInStorage, 100_000),
  };
}
