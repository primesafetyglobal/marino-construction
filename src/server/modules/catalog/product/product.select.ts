// PRODUCT SELECT: which fields may leave the server, and their types.
// The public select is written from scratch: no supplier (CAT-R9).

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const productPublicSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  brand: true,
  price: true,
  unit: true,
  isFeatured: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export const productAdminSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  brand: true,
  price: true,
  unit: true,
  isAvailable: true,
  isFeatured: true,
  categoryId: true,
  supplierId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  // D-1: supplier is a parties.Vendor relation kept from the locked schema.
  supplier: { select: { id: true, name: true, companyName: true, phone: true, email: true } },
  _count: { select: { orders: true } },
} satisfies Prisma.ProductSelect;

export const productRefSelect = { id: true, slug: true, name: true } satisfies Prisma.ProductSelect;

type Row<S extends Prisma.ProductSelect> = Prisma.ProductGetPayload<{ select: S }>;
export type ProductPublic = Row<typeof productPublicSelect>;
export type ProductAdmin = Row<typeof productAdminSelect>;
export type ProductRef = Row<typeof productRefSelect>;
export type ProductList = ({ view: "public" } & Page<ProductPublic>) | ({ view: "admin" } & Page<ProductAdmin>);
export type ProductOne = ({ view: "public" } & ProductPublic) | ({ view: "admin" } & ProductAdmin);
