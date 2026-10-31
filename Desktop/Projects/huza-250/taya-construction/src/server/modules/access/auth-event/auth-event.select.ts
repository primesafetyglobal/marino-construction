// AUTH EVENT SELECT: admin only (type, user name, ip, time, metadata without secrets).

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const authEventSelect = {
  id: true,
  type: true,
  ip: true,
  userAgent: true,
  metadata: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuthEventSelect;

export type AuthEventItem = Prisma.AuthEventGetPayload<{ select: typeof authEventSelect }>;
export type AuthEventListPage = Page<AuthEventItem>;
