// KEY ROTATION (guide §4.1): re-encrypts every FileStorage secret with the
// current FILING_ENCRYPTION_KEY (old secrets decrypt with the PREVIOUS key).
// Used by scripts/filing-rotate-key.ts. No "server-only": the script imports it.

import { db } from "@/server/validation/db";
import { decrypt, encrypt, needsReencrypt } from "./crypto";
import { invalidateStorages } from "./storage/registry";

export async function rotateStorageSecrets(opts: { dryRun: boolean }): Promise<{ total: number; changed: string[] }> {
  const rows = await db.fileStorage.findMany({ select: { id: true, name: true, secretAccessKey: true } });
  const changed: string[] = [];
  for (const r of rows) {
    if (!needsReencrypt(r.secretAccessKey)) continue;
    const next = encrypt(decrypt(r.secretAccessKey));
    if (!opts.dryRun) await db.fileStorage.update({ where: { id: r.id }, data: { secretAccessKey: next } });
    changed.push(r.name);
  }
  if (!opts.dryRun && changed.length) invalidateStorages();
  return { total: rows.length, changed };
}
