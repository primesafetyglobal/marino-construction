// ENCRYPTION of FileStorage.secretAccessKey (guide §4.1). AES-256-GCM.
// Output: <keyId>:<iv b64>:<tag b64>:<cipher b64>.
// Keys are read lazily, so the app starts without FILING_ENCRYPTION_KEY; any
// encrypt / decrypt then fails with ENCRYPTION_KEY_INVALID.
// No "server-only": scripts and tests import it.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { FilingError } from "./errors";

type Key = { id: string; key: Buffer };

const parse = (v?: string) => (v ? Buffer.from(v.replace(/^base64:/, ""), "base64") : null);

function keys(): Key[] {
  const cur = parse(process.env.FILING_ENCRYPTION_KEY);
  if (!cur || cur.length !== 32) throw new FilingError("ENCRYPTION_KEY_INVALID", "FILING_ENCRYPTION_KEY must be 32 bytes (base64).");
  const list: Key[] = [{ id: process.env.FILING_ENCRYPTION_KEY_ID || "k1", key: cur }];
  const prev = parse(process.env.FILING_ENCRYPTION_KEY_PREVIOUS);
  if (prev) {
    if (prev.length !== 32) throw new FilingError("ENCRYPTION_KEY_INVALID", "FILING_ENCRYPTION_KEY_PREVIOUS must be 32 bytes (base64).");
    list.push({ id: process.env.FILING_ENCRYPTION_KEY_PREVIOUS_ID || "k0", key: prev });
  }
  return list;
}

export function hasEncryptionKey(): boolean {
  try {
    keys();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plain: string): string {
  const { id, key } = keys()[0];
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [id, iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [id, iv, tag, data] = payload.split(":");
  if (!id || !iv || !tag || data === undefined) throw new FilingError("ENCRYPTION_KEY_INVALID", "Stored secret is not encrypted.");
  const entry = keys().find((k) => k.id === id);
  if (!entry) throw new FilingError("ENCRYPTION_KEY_INVALID", `Unknown encryption key id "${id}".`);
  const d = createDecipheriv("aes-256-gcm", entry.key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

export const needsReencrypt = (payload: string) => !payload.startsWith(`${keys()[0].id}:`);
