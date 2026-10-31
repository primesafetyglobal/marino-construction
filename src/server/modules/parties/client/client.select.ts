// CLIENT SELECT: which fields may leave the server (staff only), and their types.
// Clients are never returned by public actions.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { PartiesOut } from "../parties.dates";

export const clientListSelect = {
  id: true,
  name: true,
  companyName: true,
  entityType: true,
  phone: true,
  email: true,
  tin: true,
  district: true,
  createdAt: true,
  _count: { select: { equipmentRequests: true, supplyOrders: true, serviceRequests: true, workforceRequests: true } },
} satisfies Prisma.ClientSelect;

// D-1: requests (operations) and reviews (access) through the locked schema's relations.
export const clientDetailSelect = {
  id: true,
  name: true,
  companyName: true,
  entityType: true,
  phone: true,
  email: true,
  tin: true,
  district: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  equipmentRequests: {
    select: { id: true, number: true, type: true, status: true, createdAt: true, equipment: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  },
  supplyOrders: { select: { id: true, number: true, items: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 },
  serviceRequests: {
    select: { id: true, number: true, status: true, createdAt: true, service: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  },
  workforceRequests: { select: { id: true, number: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 },
  reviews: { select: { id: true, rating: true, message: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
} satisfies Prisma.ClientSelect;

export const clientRefSelect = { id: true, name: true, companyName: true, phone: true, email: true } satisfies Prisma.ClientSelect;

export const clientPaymentSelect = {
  id: true,
  amount: true,
  status: true,
  method: true,
  dueDate: true,
  paidAt: true,
  equipmentRequest: { select: { number: true } },
  supplyOrder: { select: { number: true } },
  serviceRequest: { select: { number: true } },
} satisfies Prisma.PaymentSelect;

type Row<S extends Prisma.ClientSelect> = Prisma.ClientGetPayload<{ select: S }>;
export type ClientListItem = Row<typeof clientListSelect>;
export type ClientRef = Row<typeof clientRefSelect>;
export type ClientPayment = PartiesOut<Prisma.PaymentGetPayload<{ select: typeof clientPaymentSelect }>>;
export type ClientDetail = Row<typeof clientDetailSelect> & { payments: ClientPayment[]; can: { delete: boolean } };
export type ClientListPage = Page<ClientListItem>;
