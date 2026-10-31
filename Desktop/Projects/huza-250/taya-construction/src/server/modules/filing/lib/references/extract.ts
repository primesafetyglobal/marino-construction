// URL EXTRACTION from declared columns (jobs): yields every URL value of a
// column with its row's primary key. `url` and `url[]` are read as values;
// `text` and `json` are scanned for URLs of the given bases.

import { db } from "@/server/validation/db";
import { q, type FileReference } from "./registry";

const BATCH = 1000;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function* extractUrls(ref: FileReference, bases: string[]): AsyncGenerator<{ pk: string; url: string }> {
  let after: string | null = null;
  const patterns = bases.flatMap((b) => [
    new RegExp(`${escapeRegex(b)}/[^\\s"'<>)\\]]+`, "g"),
    new RegExp(`${escapeRegex(b.replace(/\//g, "\\/"))}\\\\/[^\\s"'<>)\\]]+`, "g"),
  ]);
  for (;;) {
    const rows: { pk: string; v: unknown }[] = after === null
      ? await db.$queryRawUnsafe(`SELECT ${q(ref.pk)}::text AS pk, ${q(ref.column)} AS v FROM ${q(ref.table)} WHERE ${q(ref.column)} IS NOT NULL ORDER BY ${q(ref.pk)} LIMIT ${BATCH}`)
      : await db.$queryRawUnsafe(`SELECT ${q(ref.pk)}::text AS pk, ${q(ref.column)} AS v FROM ${q(ref.table)} WHERE ${q(ref.column)} IS NOT NULL AND ${q(ref.pk)}::text > $1 ORDER BY ${q(ref.pk)} LIMIT ${BATCH}`, after);
    if (!rows.length) return;
    for (const r of rows) {
      if (ref.type === "url") {
        if (typeof r.v === "string" && r.v.trim()) yield { pk: r.pk, url: r.v };
      } else if (ref.type === "url[]") {
        for (const u of (r.v as string[]) ?? []) if (u) yield { pk: r.pk, url: u };
      } else {
        const text = typeof r.v === "string" ? r.v : JSON.stringify(r.v);
        const seen = new Set<string>();
        for (const re of patterns) for (const m of text.matchAll(re)) {
          const url = m[0].replace(/\\\//g, "/");
          if (!seen.has(url)) {
            seen.add(url);
            yield { pk: r.pk, url };
          }
        }
      }
    }
    after = rows[rows.length - 1].pk;
  }
}
