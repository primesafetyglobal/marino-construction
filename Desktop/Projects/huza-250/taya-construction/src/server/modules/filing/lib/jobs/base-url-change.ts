// BASE_URL_CHANGE (guide §8.6): same storage, new address (CDN, custom domain,
// URL style). The test runs against the new base first; then the new
// publicBaseUrl is saved and old canonical base → new base is swapped in every
// declared reference. Dry run: test and counts only, nothing saved.

import { db } from "@/server/validation/db";
import { FilingError } from "../errors";
import { progress } from "../progress";
import { references } from "../references/registry";
import { countWithBase, rewriteReference } from "../references/rewrite";
import { getStorage, invalidateStorages } from "../storage/registry";
import { testStorage } from "../storage/test";
import { canonicalBase } from "../storage/urls";

export async function runBaseUrlChange(jobId: string, opts: { storageId: string; publicBaseUrl: string | null; dryRun: boolean }) {
  const s = await getStorage(opts.storageId);
  const oldBase = canonicalBase(s);
  const next = { ...s, publicBaseUrl: opts.publicBaseUrl };
  const newBase = canonicalBase(next);
  if (oldBase === newBase) throw new FilingError("STORAGE_TEST_FAILED", "The new base URL is the same as the current one.");
  progress.set(jobId, { phase: "TESTING" });
  const test = await testStorage(next);
  if (!test.ok) throw new FilingError("STORAGE_TEST_FAILED", "The storage test failed against the new base URL.");
  if (!opts.dryRun) {
    await db.fileStorage.update({ where: { id: s.id }, data: { publicBaseUrl: opts.publicBaseUrl } });
    invalidateStorages();
  }
  const columns: { table: string; column: string; rows: number }[] = [];
  for (const ref of references()) {
    progress.set(jobId, { phase: `${ref.table}.${ref.column}` });
    const rows = await rewriteReference(ref, oldBase, newBase, { dryRun: opts.dryRun });
    columns.push({ table: ref.table, column: ref.column, rows });
  }
  let remaining = 0;
  if (!opts.dryRun) for (const ref of references()) remaining += await countWithBase(ref, oldBase);
  return { storageId: s.id, oldBase, newBase, test, columns, summary: { rows: columns.reduce((n, c) => n + c.rows, 0), remaining } };
}
