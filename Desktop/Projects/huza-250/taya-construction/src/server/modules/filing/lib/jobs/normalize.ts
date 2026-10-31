// NORMALIZE (guide §8.3): one canonical format in every declared reference.
// 1. each base variant → canonical base (batched rewrite, §7.2)
// 2. query strings removed from own URLs in url / url[] columns
// 3. legacyUrl-matched values replaced by the canonical URL
// Required before a migration, so the swap only matches one base.

import { db } from "@/server/validation/db";
import { progress } from "../progress";
import { extractUrls } from "../references/extract";
import { references } from "../references/registry";
import { replaceValue, rewriteReference } from "../references/rewrite";
import { storages } from "../storage/registry";
import { baseVariants, buildUrl, canonicalBase, cleanUrl, parseUrl } from "../storage/urls";
import { allBases, cap, type RefItem } from "./common";

export async function runNormalize(jobId: string, opts: { dryRun: boolean }) {
  const all = [...(await storages()).values()];
  const rewrites: { table: string; column: string; from: string; to: string; rows: number }[] = [];
  const values: (RefItem & { to: string; reason: string })[] = [];
  // 1. base variants
  for (const s of all) {
    const canonical = canonicalBase(s);
    for (const variant of baseVariants(s)) {
      if (variant === canonical || canonical.startsWith(`${variant}/`)) continue;
      for (const ref of references()) {
        progress.set(jobId, { phase: `${ref.table}.${ref.column}` });
        const rows = await rewriteReference(ref, variant, canonical, { dryRun: opts.dryRun });
        if (rows) rewrites.push({ table: ref.table, column: ref.column, from: variant, to: canonical, rows });
      }
    }
  }
  // 2 + 3. query strings and legacy values, value by value
  const bases = await allBases();
  const legacyCount = await db.file.count({ where: { legacyUrl: { not: null } } });
  for (const ref of references()) {
    for await (const { pk, url } of extractUrls(ref, bases)) {
      const clean = cleanUrl(url);
      let to: string | null = null;
      let reason = "";
      const p = await parseUrl(clean);
      if (p) {
        const row = await db.file.findUnique({ where: { key: p.key }, select: { key: true, storageId: true } });
        const s = row ? all.find((x) => x.id === row.storageId) : null;
        const canonical = s && row ? buildUrl(s, row.key) : clean;
        if (url !== canonical && (url !== clean || (ref.type !== "text" && ref.type !== "json"))) {
          to = canonical;
          reason = url !== clean ? "query string" : "non-canonical";
        }
      } else if (legacyCount && (ref.type === "url" || ref.type === "url[]" || /^https?:\/\//.test(url))) {
        const row = await db.file.findUnique({ where: { legacyUrl: clean }, select: { key: true, storageId: true } });
        const s = row ? all.find((x) => x.id === row.storageId) : null;
        if (s && row) {
          to = buildUrl(s, row.key);
          reason = "legacy URL";
        }
      }
      if (!to || to === url) continue;
      if (!opts.dryRun) await replaceValue(ref, pk, url, to);
      values.push({ table: ref.table, column: ref.column, pk, value: url, to, reason });
      progress.inc(jobId, "done");
    }
  }
  return {
    summary: { baseRewrites: rewrites.reduce((n, r) => n + r.rows, 0), valueFixes: values.length },
    rewrites,
    values: cap(values, 100_000),
  };
}
