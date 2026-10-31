// REFERENCE_CHECK (guide §8.2): verifies every URL stored in the declared
// references and classifies it. Read-only; fixes are applied separately
// (applyFixes) from a saved report.

import pLimit from "p-limit";
import { db } from "@/server/validation/db";
import { FilingError } from "../errors";
import { progress } from "../progress";
import { readReport } from "../reports";
import { extractUrls } from "../references/extract";
import { references, type FileReference } from "../references/registry";
import { replaceValue } from "../references/rewrite";
import * as ops from "../storage/ops";
import { getStorage, storages } from "../storage/registry";
import { buildUrl, cleanUrl, parseUrl } from "../storage/urls";
import { allBases, refOf, type RefItem } from "./common";
import { referenceMap, registerObjects } from "./import";

export type CheckItem = RefItem & { canonical?: string; storageId?: string; key?: string; reason?: string };

export type ReferenceCheckReport = {
  summary: { ok: number; nonCanonical: number; query: number; unregistered: number; missing: number; readOnly: number; external: number };
  nonCanonical: CheckItem[];
  query: CheckItem[];
  unregistered: CheckItem[];
  missing: CheckItem[];
  readOnly: CheckItem[];
};

export const FIX_CATEGORIES = ["nonCanonical", "query", "readOnly", "missing", "unregistered"] as const;
export type FixCategory = (typeof FIX_CATEGORIES)[number];

const BATCH = 500;

export async function runReferenceCheck(jobId: string, opts: { headCheck?: boolean } = {}): Promise<ReferenceCheckReport> {
  const all = await storages();
  const bases = await allBases();
  const out: ReferenceCheckReport = {
    summary: { ok: 0, nonCanonical: 0, query: 0, unregistered: 0, missing: 0, readOnly: 0, external: 0 },
    nonCanonical: [],
    query: [],
    unregistered: [],
    missing: [],
    readOnly: [],
  };
  const limit = pLimit(4);
  const push = (cat: Exclude<keyof ReferenceCheckReport, "summary">, item: CheckItem) => {
    out[cat].push(item);
    out.summary[cat]++;
  };

  const classify = async (ref: FileReference, items: { pk: string; url: string }[]) => {
    const parsed = await Promise.all(items.map((i) => parseUrl(i.url)));
    const keys = [...new Set(parsed.flatMap((p) => (p ? [p.key] : [])))];
    const cleaned = [...new Set(items.map((i) => cleanUrl(i.url)))];
    const rows = await db.file.findMany({
      where: { OR: [{ key: { in: keys } }, { legacyUrl: { in: cleaned } }] },
      select: { id: true, key: true, storageId: true, status: true, legacyUrl: true },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const byLegacy = new Map(rows.filter((r) => r.legacyUrl).map((r) => [r.legacyUrl!, r]));
    await Promise.all(
      items.map((it, i) =>
        limit(async () => {
          const base = { table: ref.table, column: ref.column, pk: it.pk, value: it.url };
          const p = parsed[i];
          const clean = cleanUrl(it.url);
          const row = (p && byKey.get(p.key)) || byLegacy.get(clean);
          if (!row) {
            if (p) push("unregistered", { ...base, storageId: p.storage.id, key: p.key });
            else out.summary.external++;
            return;
          }
          const s = all.get(row.storageId);
          if (!s) return push("missing", { ...base, reason: "Storage removed" });
          const canonical = buildUrl(s, row.key);
          if (row.status !== "ACTIVE") return push("missing", { ...base, key: row.key, reason: "File deleted" });
          if (opts.headCheck !== false && !(await ops.head(s, row.key))) return push("missing", { ...base, key: row.key, reason: "Object gone" });
          if (it.url === canonical) return void out.summary.ok++;
          if (it.url !== clean) return push("query", { ...base, canonical, reason: /X-Amz-/i.test(it.url) ? "Stored presigned URL" : "Query string" });
          if (p && p.storage.id !== row.storageId && p.storage.isReadOnly) return push("readOnly", { ...base, canonical });
          push("nonCanonical", { ...base, canonical, reason: p ? "Other base" : "Legacy URL" });
        }),
      ),
    );
  };

  for (const ref of references()) {
    progress.set(jobId, { phase: `${ref.table}.${ref.column}` });
    let buf: { pk: string; url: string }[] = [];
    for await (const item of extractUrls(ref, bases)) {
      buf.push(item);
      if (buf.length >= BATCH) {
        await classify(ref, buf);
        progress.inc(jobId, "done", buf.length);
        buf = [];
      }
    }
    if (buf.length) {
      await classify(ref, buf);
      progress.inc(jobId, "done", buf.length);
    }
  }
  return out;
}

/** Applies chosen fix categories of a saved REFERENCE_CHECK report. */
export async function applyFixes(jobId: string, opts: { reportName: string; categories: FixCategory[]; dryRun: boolean }) {
  const report = await readReport<ReferenceCheckReport & { type: string }>(opts.reportName);
  if (!report || report.type !== "REFERENCE_CHECK") throw new FilingError("FILE_NOT_FOUND", "Report not found.");
  const result: Record<string, number> = {};
  const failures: { item: CheckItem; reason: string }[] = [];
  for (const cat of opts.categories) {
    let n = 0;
    const items = report[cat] ?? [];
    if (cat === "unregistered") {
      // Register the objects (HEAD gives size and date), per storage.
      const byStorage = new Map<string, CheckItem[]>();
      for (const it of items) if (it.storageId && it.key) byStorage.set(it.storageId, [...(byStorage.get(it.storageId) ?? []), it]);
      for (const [storageId, list] of byStorage) {
        const s = await getStorage(storageId);
        const refs = await referenceMap(s);
        const objs = [];
        for (const it of list) {
          const h = await ops.head(s, it.key!);
          if (h) objs.push({ key: it.key!, size: h.size, lastModified: h.lastModified });
          else failures.push({ item: it, reason: "Object not in storage" });
        }
        n += (await registerObjects(s, [...new Map(objs.map((o) => [o.key, o])).values()], refs, opts.dryRun)).created;
      }
    } else {
      for (const it of items) {
        try {
          const ref = refOf(it.table, it.column);
          if (cat === "missing") {
            if (ref.type !== "url" && ref.type !== "url[]") continue; // text/json: left for a person
            n += opts.dryRun ? 1 : await replaceValue(ref, it.pk, it.value, null);
          } else if (it.canonical) {
            n += opts.dryRun ? 1 : await replaceValue(ref, it.pk, it.value, it.canonical);
          }
        } catch (e) {
          failures.push({ item: it, reason: (e as Error).message });
        }
        progress.inc(jobId, "done");
      }
    }
    result[cat] = n;
  }
  return { reportName: opts.reportName, summary: { ...result, failed: failures.length }, failures };
}
