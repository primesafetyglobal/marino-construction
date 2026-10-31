// Facts about the current request, for audit logs and rate limits.

import "server-only";
import { headers } from "next/headers";
import type { SessionUser } from "./auth";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

// What services receive when they need to know who is acting.
export type ServiceContext = {
  actor: SessionUser;
  meta: RequestMeta;
};

// ADJUST: x-forwarded-for is trusted because production runs behind a proxy
// we control (recorded in docs/DNSA.md, host setup). Otherwise clients can fake it.
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return metaFromHeaders(h);
}

export function metaFromHeaders(h: Pick<Headers, "get">): RequestMeta {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}

export async function contextFor(user: SessionUser): Promise<ServiceContext> {
  return { actor: user, meta: await getRequestMeta() };
}
