// OPERATIONS SELECT: shapes several request folders share. Types only (plus
// select objects, which are plain data).

import type { Prisma } from "@/server/validation/db";

// D-1: the client and handler relations kept by the locked schema.
export const clientCardSelect = {
  id: true,
  name: true,
  companyName: true,
  entityType: true,
  phone: true,
  email: true,
  district: true,
  tin: true,
} satisfies Prisma.ClientSelect;

export const clientNameSelect = { id: true, name: true, companyName: true } satisfies Prisma.ClientSelect;
export const userRefSelect = { id: true, name: true } satisfies Prisma.UserSelect;
export const vendorCardSelect = { id: true, name: true, companyName: true, phone: true, email: true, status: true, isPartner: true } satisfies Prisma.VendorSelect;

export type ClientCard = Prisma.ClientGetPayload<{ select: typeof clientCardSelect }>;
export type UserRef = Prisma.UserGetPayload<{ select: typeof userRefSelect }>;

export type UploadTicket = { uploadUrl: string; headers: Record<string, string>; uploadToken: string; expiresAt: string };

export type RequestCan = { update: boolean; moves: string[] };
