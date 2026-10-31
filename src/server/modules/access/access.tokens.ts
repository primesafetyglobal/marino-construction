// access.tokens.ts, no server-only: the seed and scripts/reset-super-admin.ts
// import it. Pure helpers for one-time tokens (ACC-R5): 32 random bytes in
// the link, only the SHA-256 hash in the database. Uses node:crypto, so it
// never reaches the browser.

import { createHash, randomBytes } from "node:crypto";

export const newRawToken = () => randomBytes(32).toString("base64url");

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");
