// DISCOVERY (guide §7.3): finds columns that hold storage URLs but are not
// declared. Each count has a 30 s statement_timeout; timed-out columns are
// listed as "not checked".

import { db } from "@/server/validation/db";
import { escapeLike, escapeSlashes, q, references } from "./registry";

export type DiscoveryFinding = { table: string; column: string; dataType: string; typeGuess: string; rows: number; line: string };
export type DiscoveryResult = { findings: DiscoveryFinding[]; notChecked: { table: string; column: string; reason: string }[]; checkedColumns: number };

const SKIP_TABLES = new Set(["File", "FileStorage", "FileSettings", "FileBackup", "_prisma_migrations"]);

export async function discover(bases: string[], opts: { timeoutMs?: number } = {}): Promise<DiscoveryResult> {
  const declared = new Set(references().map((r) => `${r.table}.${r.column}`));
  const cols: { table_name: string; column_name: string; data_type: string; udt_name: string }[] = await db.$queryRawUnsafe(
    `SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND data_type IN ('text', 'character varying', 'ARRAY', 'json', 'jsonb')`,
  );
  const pats = bases.flatMap((b) => [`%${escapeLike(b)}/%`, `%${escapeLike(escapeSlashes(b))}${escapeLike("\\/")}%`]);
  const result: DiscoveryResult = { findings: [], notChecked: [], checkedColumns: 0 };
  if (!pats.length) return result;
  for (const c of cols) {
    if (SKIP_TABLES.has(c.table_name) || declared.has(`${c.table_name}.${c.column_name}`)) continue;
    try {
      q(c.table_name);
      q(c.column_name);
    } catch {
      result.notChecked.push({ table: c.table_name, column: c.column_name, reason: "unusual identifier" });
      continue;
    }
    if (c.data_type === "ARRAY" && !["_text", "_varchar"].includes(c.udt_name)) continue;
    try {
      const n = await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(1000, opts.timeoutMs ?? 30_000)}`);
        const conds = pats.map((_, i) => `${q(c.column_name)}::text LIKE $${i + 1}`).join(" OR ");
        const rows: { n: number }[] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(c.table_name)} WHERE ${conds}`, ...pats);
        return rows[0]?.n ?? 0;
      });
      result.checkedColumns++;
      if (n > 0) {
        const typeGuess = c.data_type === "ARRAY" ? "url[]" : c.data_type.startsWith("json") ? "json" : "url or text";
        const t = typeGuess === "url or text" ? "url" : typeGuess;
        result.findings.push({
          table: c.table_name,
          column: c.column_name,
          dataType: c.data_type,
          typeGuess,
          rows: n,
          line: `{ table: "${c.table_name}", column: "${c.column_name}", type: "${t}", pk: "id", label: "${c.table_name} ${c.column_name}" },`,
        });
      }
    } catch (e) {
      result.notChecked.push({ table: c.table_name, column: c.column_name, reason: /timeout/i.test((e as Error).message) ? "timed out" : "query failed" });
    }
  }
  return result;
}
