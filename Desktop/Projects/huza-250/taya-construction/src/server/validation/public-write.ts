// Protection shared by every public write (DNSA ch. 23.2, docs/DNSA.md D-7).
//
// Services call guardPublicWrite() after the honeypot check:
//   1. rate limit: 5 per minute per hashed IP and form scope
//   2. Cloudflare Turnstile: verified when keys are configured
// The schema already demanded consent where personal data is collected.

import "server-only";
import { Errors } from "../core/errors";
import { verifyTurnstile } from "../integrations/turnstile";
import { checkRateLimit, PUBLIC_WRITE_LIMIT } from "./rate-limit";
import type { RequestMeta } from "./request";

export async function guardPublicWrite(opts: { scope: string; meta: RequestMeta; turnstileToken?: string | null }) {
  checkRateLimit({ scope: opts.scope, ip: opts.meta.ip, ...PUBLIC_WRITE_LIMIT });
  const human = await verifyTurnstile(opts.turnstileToken ?? null, opts.meta.ip);
  if (!human) {
    throw Errors.invalid("Please complete the security check and try again.", {
      turnstileToken: ["Security check failed."],
    });
  }
}

// A honeypot field is filled only by bots. The service then returns a
// normal-looking reply and saves nothing (a validation error would tell the
// bot it was detected).
export function isBot(honeypot: string | null | undefined): boolean {
  return typeof honeypot === "string" && honeypot.trim().length > 0;
}
