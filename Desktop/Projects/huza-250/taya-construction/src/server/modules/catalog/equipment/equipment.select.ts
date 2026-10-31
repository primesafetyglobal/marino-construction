// EQUIPMENT SELECT: which fields may leave the server, and their types.
//
// The public selects are written from scratch (DNSA 23.1): no owner, no
// ownerId, no counts. The service also builds public results field by field.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { Spec } from "../catalog.select";

export const equipmentPublicSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  specs: true,
  location: true,
  forRent: true,
  rentPrice: true,
  rentUnit: true,
  forSale: true,
  salePrice: true,
  status: true,
  isFeatured: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.EquipmentSelect;

export const equipmentAdminSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  specs: true,
  location: true,
  forRent: true,
  rentPrice: true,
  rentUnit: true,
  forSale: true,
  salePrice: true,
  status: true,
  isFeatured: true,
  categoryId: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  // D-1: owner is a parties.Vendor relation kept from the locked schema.
  owner: { select: { id: true, name: true, companyName: true, phone: true, email: true, status: true, isPartner: true } },
  _count: { select: { requests: true } },
} satisfies Prisma.EquipmentSelect;

export const equipmentRefSelect = { id: true, slug: true, name: true, status: true } satisfies Prisma.EquipmentSelect;

type Row<S extends Prisma.EquipmentSelect> = Prisma.EquipmentGetPayload<{ select: S }>;

export type EquipmentPublic = Omit<Row<typeof equipmentPublicSelect>, "specs"> & { specs: Spec[] };
export type EquipmentAdmin = Omit<Row<typeof equipmentAdminSelect>, "specs"> & { specs: Spec[] };
export type EquipmentRef = Row<typeof equipmentRefSelect>;

export type EquipmentList = ({ view: "public" } & Page<EquipmentPublic>) | ({ view: "admin" } & Page<EquipmentAdmin>);
export type EquipmentOne = ({ view: "public" } & EquipmentPublic) | ({ view: "admin" } & EquipmentAdmin);
