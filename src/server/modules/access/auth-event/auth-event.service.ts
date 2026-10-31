// AUTH EVENT SERVICE: the log of logins and account changes; also the source
// of the login and reset rate limits.
//
// Rules:
// - ACC-R1 an ADMIN never sees events of SUPER_ADMIN users (NOT_FOUND)
// - ACC-R7 rate limits count recent events (countRecentEvents)
// - ACC-R9 write-only from the server; metadata never holds a password or a
//          token (safeMetadata drops such keys)

import "server-only";
import { Errors } from "@/server/core/errors";
import type { SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { ACCESS_CONFIG } from "../access.config";
import type { AuthEventType, ListAuthEventsData } from "./auth-event.schema";
import { authEventSelect, type AuthEventItem, type AuthEventListPage } from "./auth-event.select";

type Actor = { actor: SessionUser };

// ACC-R1: what this actor may see.
export function eventScope(actor: SessionUser): Prisma.AuthEventWhereInput {
  if (actor.role === "SUPER_ADMIN") return {};
  return { OR: [{ userId: null }, { user: { is: { role: { not: "SUPER_ADMIN" } } } }] };
}

// ======================= Reads =======================

export async function listAuthEvents(query: ListAuthEventsData, ctx: Actor): Promise<AuthEventListPage> {
  const and: Prisma.AuthEventWhereInput[] = [eventScope(ctx.actor)];
  if (query.userId) and.push({ userId: query.userId });
  if (query.type) and.push({ type: query.type });
  if (query.from) and.push({ createdAt: { gte: query.from } });
  if (query.to) and.push({ createdAt: { lte: query.to } });
  const rows = await db.authEvent.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: authEventSelect,
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

export function getAuthEventDetail(id: string, ctx: Actor): Promise<AuthEventItem | null> {
  return db.authEvent.findFirst({ where: { AND: [{ id }, eventScope(ctx.actor)] }, select: authEventSelect });
}

// The last 20 events of one user (user detail page). ACC-R1: a hidden user → NOT_FOUND.
export async function getUserActivity(userId: string, ctx: Actor): Promise<AuthEventItem[]> {
  const user = await db.user.findFirst({
    where: { id: userId, ...(ctx.actor.role === "SUPER_ADMIN" ? {} : { role: { not: "SUPER_ADMIN" } }) },
    select: { id: true },
  });
  if (!user) throw Errors.notFound("User");
  return db.authEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: authEventSelect,
    take: ACCESS_CONFIG.activityLimit,
  });
}

// ======================= Shared with other services (access only) =======================

const SECRET_KEYS = /pass|token|secret|hash/i;

// ACC-R9: metadata never holds a password or a token.
export function safeMetadata(metadata: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata).filter(([k, v]) => !SECRET_KEYS.test(k) && v !== undefined)) as Prisma.InputJsonValue;
}

// ACC-R9. createdAt comes from the app clock, the same clock as the session's
// loginAt (D-9).
export async function recordAuthEvent(
  event: { type: AuthEventType; userId?: string | null; ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> },
  client: DbClient,
): Promise<void> {
  await client.authEvent.create({
    data: {
      type: event.type,
      userId: event.userId ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      metadata: safeMetadata(event.metadata),
      createdAt: new Date(),
    },
  });
}

// ACC-R7: how many events of a type in the window, for one email or one IP.
export async function countRecentEvents(
  opts: { type: AuthEventType; windowMs: number; email?: string; ip?: string | null },
  client: DbClient,
): Promise<number> {
  const since = new Date(Date.now() - opts.windowMs);
  if (opts.email) {
    return client.authEvent.count({ where: { type: opts.type, createdAt: { gte: since }, metadata: { path: ["email"], equals: opts.email } } });
  }
  if (!opts.ip) return 0;
  return client.authEvent.count({ where: { type: opts.type, ip: opts.ip, createdAt: { gte: since } } });
}
