// In-memory rate limits for public writes and public reads (D-7, docs/DNSA.md).
//
// The locked schema has no ipHash columns, so DNSA 23.2's "count recent rows"
// is replaced by a sliding window in memory, keyed by HMAC-SHA256(ip) with
// a key derived from NEXTAUTH_SECRET. The raw IP is never stored or logged.
// Tech debt (Roadmap §4): move to Redis if the app runs on several servers.
//
// No "server-only": the unit tests import it directly. It uses node:crypto,
// so it never reaches the browser.

import { createHmac } from "node:crypto";
import { Errors } from "../core/errors";
import { derivedSecret } from "./secrets";

const windows = new Map<string, number[]>();
let lastSweep = 0;

const secret = () => derivedSecret("rate-limit:ip");

export function hashIp(ip: string | null): string {
  return createHmac("sha256", secret()).update(ip ?? "unknown").digest("hex");
}

// Throws RATE_LIMITED when `limit` calls already happened in the window.
export function checkRateLimit(opts: { scope: string; ip: string | null; limit: number; windowMs: number; now?: number }) {
  const now = opts.now ?? Date.now();
  const key = `${opts.scope}:${hashIp(opts.ip)}`;
  const recent = (windows.get(key) ?? []).filter((t) => t > now - opts.windowMs);
  if (recent.length >= opts.limit) {
    windows.set(key, recent);
    throw Errors.rateLimited();
  }
  recent.push(now);
  windows.set(key, recent);
  sweep(now, opts.windowMs);
}

// Bounded memory: drop empty windows now and then.
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of windows) {
    if (!times.some((t) => t > now - Math.max(windowMs, 3_600_000))) windows.delete(key);
  }
}

// Tests only.
export function resetRateLimits() {
  windows.clear();
}

// The public write and read limits (Architecture §9: 5 per minute per IP).
export const PUBLIC_WRITE_LIMIT = { limit: 5, windowMs: 60_000 } as const;
export const PUBLIC_READ_LIMIT = { limit: 120, windowMs: 60_000 } as const;
