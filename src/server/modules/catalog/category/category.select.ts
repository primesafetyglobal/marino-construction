// CATEGORY SELECT: which fields may leave the server, and their types.

import type { Prisma } from "@/server/validation/db";

// Categories hold no private data ("Select: all fields"), but the public
// select is still written separately so counts never reach visitors.
export const categoryPublicSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  division: true,
  description: true,
  image: true,
  order: true,
} satisfies Prisma.CategorySelect;

export const categoryAdminSelect = {
  ...categoryPublicSelect,
  createdAt: true,
  updatedAt: true,
  _count: { select: { equipment: true, products: true, services: true } },
} satisfies Prisma.CategorySelect;

export const categoryRefSelect = { id: true, name: true, slug: true, type: true } satisfies Prisma.CategorySelect;

type Row<S extends Prisma.CategorySelect> = Prisma.CategoryGetPayload<{ select: S }>;
export type CategoryPublic = Row<typeof categoryPublicSelect>;
export type CategoryAdmin = Row<typeof categoryAdminSelect>;
export type CategoryRef = Row<typeof categoryRefSelect>;
export type CategoryList = { view: "public"; items: CategoryPublic[] } | { view: "admin"; items: CategoryAdmin[] };
