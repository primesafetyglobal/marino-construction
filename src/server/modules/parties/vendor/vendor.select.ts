// VENDOR SELECT: which fields may leave the server, and their types.
// The partner select is the only public one, written from scratch (PTY-R7).

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const vendorPartnerSelect = { id: true, name: true, companyName: true, logo: true, website: true } satisfies Prisma.VendorSelect;

export const vendorListSelect = {
  id: true,
  name: true,
  companyName: true,
  entityType: true,
  type: true,
  phone: true,
  email: true,
  district: true,
  status: true,
  isPartner: true,
  logo: true,
  createdAt: true,
} satisfies Prisma.VendorSelect;

// D-1: equipment / products (catalog) and requests (operations) through relations.
export const vendorDetailSelect = {
  ...vendorListSelect,
  tin: true,
  offerings: true,
  website: true,
  notes: true,
  updatedAt: true,
  equipment: { select: { id: true, name: true, status: true, slug: true }, orderBy: { createdAt: "desc" }, take: 100 },
  products: { select: { id: true, name: true, slug: true }, orderBy: { createdAt: "desc" }, take: 100 },
  supplyOrders: { select: { id: true, number: true, status: true, items: true }, orderBy: { createdAt: "desc" }, take: 100 },
  serviceRequests: {
    select: { id: true, number: true, status: true, service: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  },
} satisfies Prisma.VendorSelect;

export const vendorRefSelect = { id: true, name: true, status: true, isPartner: true } satisfies Prisma.VendorSelect;

type Row<S extends Prisma.VendorSelect> = Prisma.VendorGetPayload<{ select: S }>;
export type VendorPartner = Row<typeof vendorPartnerSelect>;
export type VendorListItem = Row<typeof vendorListSelect>;
export type VendorDetail = Row<typeof vendorDetailSelect> & { can: { approve: boolean; deactivate: boolean; partner: boolean; delete: boolean } };
export type VendorRef = Row<typeof vendorRefSelect>;
export type VendorListPage = Page<VendorListItem>;
export type PartnersResult = { partners: VendorPartner[]; shops: VendorPartner[] };
