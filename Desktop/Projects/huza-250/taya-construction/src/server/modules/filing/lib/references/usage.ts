// USAGE (guide §7.4): where a file URL is used, across declared columns.
// Single files only (preview drawer, delete dialog), never on list pages.

import { db } from "@/server/validation/db";
import { escapeLike, q, references } from "./registry";

export async function countUsage(urls: string[]): Promise<{ label: string; table: string; column: string; count: number }[]> {
  const pats = [...new Set(urls.filter(Boolean))].map((u) => `%${escapeLike(u)}%`);
  if (!pats.length) return [];
  const out: { label: string; table: string; column: string; count: number }[] = [];
  for (const r of references()) {
    const conds = pats.map((_, i) => `${q(r.column)}::text LIKE $${i + 1}`).join(" OR ");
    const rows: { n: number }[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(r.table)} WHERE ${conds}`, ...pats);
    const n = rows[0]?.n ?? 0;
    if (n > 0) out.push({ label: r.label, table: r.table, column: r.column, count: n });
  }
  return out;
}
