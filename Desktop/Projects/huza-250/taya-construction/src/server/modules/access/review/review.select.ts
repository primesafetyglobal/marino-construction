// REVIEW SELECT: the public select is written from scratch: no phone, email
// or client link (ACC-R13). The admin select adds the private contact.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const reviewPublicSelect = {
  id: true,
  fullName: true,
  company: true,
  division: true,
  rating: true,
  message: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

export const reviewAdminSelect = {
  id: true,
  fullName: true,
  company: true,
  division: true,
  rating: true,
  message: true,
  status: true,
  phone: true,
  email: true,
  createdAt: true,
  // D-1: client (parties) through the locked schema's relation.
  client: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

export const reviewRefSelect = { id: true, status: true } satisfies Prisma.ReviewSelect;

type Row<S extends Prisma.ReviewSelect> = Prisma.ReviewGetPayload<{ select: S }>;
export type ReviewPublic = Row<typeof reviewPublicSelect>;
export type ReviewAdmin = Row<typeof reviewAdminSelect>;
export type ReviewRef = Row<typeof reviewRefSelect>;
export type ReviewPublicPage = Page<ReviewPublic>;
export type ReviewAdminPage = Page<ReviewAdmin>;
export type ReviewSummary = { average: number | null; count: number };
export type ReviewCounters = { new: number };
