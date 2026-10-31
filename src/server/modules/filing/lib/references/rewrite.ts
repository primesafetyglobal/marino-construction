// BATCHED BASE-URL SWAP (guide §7.2). 5,000 rows per statement (primary-key
// ranges), each statement its own short transaction, values parameterized,
// LIKE patterns escaped, the trailing "/" always part of the match.

import { db } from "@/server/validation/db";
import { escapeLike, escapeSlashes, q, type FileReference } from "./registry";

export const REWRITE_BATCH = 5000;

/** Primary-key ranges of `batch` rows each. */
export async function* pkRanges(ref: FileReference, batch = REWRITE_BATCH): AsyncGenerator<{ after: string | null; until: string }> {
  let after: string | null = null;
  for (;;) {
    const rows: { pk: string }[] = after === null
      ? await db.$queryRawUnsafe(`SELECT ${q(ref.pk)}::text AS pk FROM ${q(ref.table)} ORDER BY ${q(ref.pk)} OFFSET $1 LIMIT 1`, batch - 1)
      : await db.$queryRawUnsafe(`SELECT ${q(ref.pk)}::text AS pk FROM ${q(ref.table)} WHERE ${q(ref.pk)}::text > $1 ORDER BY ${q(ref.pk)} OFFSET $2 LIMIT 1`, after, batch - 1);
    if (!rows.length) {
      const last: { pk: string }[] = await db.$queryRawUnsafe(`SELECT max(${q(ref.pk)}::text) AS pk FROM ${q(ref.table)}`);
      if (last[0]?.pk && (after === null || last[0].pk > after)) yield { after, until: last[0].pk };
      return;
    }
    yield { after, until: rows[0].pk };
    after = rows[0].pk;
  }
}

const range = (ref: FileReference, after: string | null, first: number) =>
  after === null ? `${q(ref.pk)}::text <= $${first}` : `${q(ref.pk)}::text > $${first + 1} AND ${q(ref.pk)}::text <= $${first}`;

/** Swaps oldBase → newBase in one declared column. Returns the number of rows changed. */
export async function rewriteReference(ref: FileReference, oldBase: string, newBase: string, opts: { dryRun?: boolean; batch?: number } = {}): Promise<number> {
  if (oldBase === newBase) return 0;
  let total = 0;
  const col = q(ref.column);
  const table = q(ref.table);
  const variants: [string, string][] = [[oldBase, newBase]];
  if (ref.type === "json") variants.push([escapeSlashes(oldBase), escapeSlashes(newBase)]);
  for await (const r of pkRanges(ref, opts.batch)) {
    for (const [oldB, newB] of variants) {
      const slash = ref.type === "json" && oldB !== oldBase ? "\\/" : "/";
      const like = `${escapeLike(oldB)}${escapeLike(slash)}%`;
      const params = (n: number) => [r.until, ...(r.after === null ? [] : [r.after])].length + n;
      const base = [r.until, ...(r.after === null ? [] : [r.after])];
      const p = (i: number) => `$${params(i)}`;
      let sql: string;
      let values: unknown[];
      if (opts.dryRun) {
        const cond =
          ref.type === "url" ? `${col} LIKE ${p(1)}`
          : ref.type === "url[]" ? `EXISTS (SELECT 1 FROM unnest(${col}) u WHERE u LIKE ${p(1)})`
          : `${col}::text LIKE '%' || ${p(1)}`;
        sql = `SELECT count(*)::int AS n FROM ${table} WHERE ${range(ref, r.after, 1)} AND ${cond}`;
        values = [...base, like];
        const rows: { n: number }[] = await db.$queryRawUnsafe(sql, ...values);
        total += rows[0]?.n ?? 0;
        continue;
      }
      if (ref.type === "url") {
        sql = `UPDATE ${table} SET ${col} = ${p(2)} || substring(${col} FROM length(${p(3)}) + 1) WHERE ${range(ref, r.after, 1)} AND ${col} LIKE ${p(1)}`;
        values = [...base, like, newB, oldB];
      } else if (ref.type === "url[]") {
        sql = `UPDATE ${table} SET ${col} = ARRAY(SELECT CASE WHEN u LIKE ${p(1)} THEN ${p(2)} || substring(u FROM length(${p(3)}) + 1) ELSE u END FROM unnest(${col}) WITH ORDINALITY t(u, i) ORDER BY i) WHERE ${range(ref, r.after, 1)} AND EXISTS (SELECT 1 FROM unnest(${col}) u WHERE u LIKE ${p(1)})`;
        values = [...base, like, newB, oldB];
      } else if (ref.type === "text") {
        sql = `UPDATE ${table} SET ${col} = replace(${col}, ${p(2)}, ${p(3)}) WHERE ${range(ref, r.after, 1)} AND ${col} LIKE '%' || ${p(1)}`;
        values = [...base, like, oldB + slash, newB + slash];
      } else {
        sql = `UPDATE ${table} SET ${col} = replace(${col}::text, ${p(2)}, ${p(3)})::jsonb WHERE ${range(ref, r.after, 1)} AND ${col}::text LIKE '%' || ${p(1)}`;
        values = [...base, like, oldB + slash, newB + slash];
      }
      total += await db.$executeRawUnsafe(sql, ...values);
    }
  }
  return total;
}

/** Rows of a declared column still containing `base` + "/" (also the escaped form). */
export async function countWithBase(ref: FileReference, base: string): Promise<number> {
  const pats = [`%${escapeLike(base)}/%`];
  if (ref.type === "json") pats.push(`%${escapeLike(escapeSlashes(base))}${escapeLike("\\/")}%`);
  const conds = pats.map((_, i) => `${q(ref.column)}::text LIKE $${i + 1}`).join(" OR ");
  const rows: { n: number }[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(ref.table)} WHERE ${conds}`, ...pats);
  return rows[0]?.n ?? 0;
}

/** Sets a whole `url` column value (fixes), or replaces one URL inside the other types. */
export async function replaceValue(ref: FileReference, pk: string, from: string, to: string | null): Promise<number> {
  const col = q(ref.column);
  const table = q(ref.table);
  const where = `${q(ref.pk)}::text = $1`;
  if (ref.type === "url") return db.$executeRawUnsafe(`UPDATE ${table} SET ${col} = $2 WHERE ${where} AND ${col} = $3`, pk, to, from);
  if (to === null) {
    if (ref.type === "url[]") return db.$executeRawUnsafe(`UPDATE ${table} SET ${col} = array_remove(${col}, $2) WHERE ${where}`, pk, from);
    return 0; // text/json: never cleared automatically
  }
  if (ref.type === "url[]") return db.$executeRawUnsafe(`UPDATE ${table} SET ${col} = array_replace(${col}, $2, $3) WHERE ${where}`, pk, from, to);
  if (ref.type === "text") return db.$executeRawUnsafe(`UPDATE ${table} SET ${col} = replace(${col}, $2, $3) WHERE ${where}`, pk, from, to);
  return db.$executeRawUnsafe(`UPDATE ${table} SET ${col} = replace(${col}::text, $2, $3)::jsonb WHERE ${where}`, pk, from, to);
}
