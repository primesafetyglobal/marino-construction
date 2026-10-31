// TURNSTILE: Cloudflare bot check for public forms.
//
// Contract: verifyTurnstile(token, ip) resolves true when the visitor passed.
// - With both keys set: verified with Cloudflare's siteverify API.
// - Without them (any environment): the check is skipped. The honeypot and
//   rate limit in guardPublicWrite still apply.

import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  // Both keys, or the widget never renders and every submission would fail.
  if (!isTurnstileConfigured()) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch(VERIFY_URL, { method: "POST", body });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
