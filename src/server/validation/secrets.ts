// Server keys derived from NEXTAUTH_SECRET, so no extra secrets are needed.
// Each use gets its own key: HMAC-SHA256(NEXTAUTH_SECRET, purpose).
// No "server-only": tests import it. Uses node:crypto, never reaches the browser.

import { createHmac } from "node:crypto";

export function derivedSecret(purpose: string): string {
  const base = process.env.NEXTAUTH_SECRET;
  if (!base || base.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET is not set.");
    return createHmac("sha256", "dev-only-secret-not-for-production").update(purpose).digest("hex");
  }
  return createHmac("sha256", base).update(purpose).digest("hex");
}
