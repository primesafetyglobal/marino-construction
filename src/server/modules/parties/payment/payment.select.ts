// PAYMENT SELECT: admin only, and its types. dueDate leaves as "YYYY-MM-DD".

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { PartiesOut } from "../parties.dates";
import type { PayableType } from "../parties.select";

const requestRef = { id: true, number: true, client: { select: { id: true, name: true } } } as const;

// D-1: the three request relations kept by the locked schema.
export const paymentSelect = {
  id: true,
  amount: true,
  status: true,
  method: true,
  dueDate: true,
  paidAt: true,
  reference: true,
  createdAt: true,
  equipmentRequestId: true,
  supplyOrderId: true,
  serviceRequestId: true,
  equipmentRequest: { select: requestRef },
  supplyOrder: { select: requestRef },
  serviceRequest: { select: { ...requestRef, service: { select: { name: true } } } },
} satisfies Prisma.PaymentSelect;

export const paymentRefSelect = { id: true, amount: true, status: true } satisfies Prisma.PaymentSelect;

export type PaymentRequestRef = { type: PayableType; id: string; number: number; code: string; href: string; clientId: string; clientName: string };

export type PaymentItem = PartiesOut<
  Pick<Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>, "id" | "amount" | "status" | "method" | "dueDate" | "paidAt" | "reference" | "createdAt">
> & { request: PaymentRequestRef | null; isOverdue: boolean };

export type PaymentRef = Prisma.PaymentGetPayload<{ select: typeof paymentRefSelect }>;
export type PaymentListPage = Page<PaymentItem>;
export type PaymentSummary = { quotedAmount: number | null; paid: number; due: number; outstanding: number | null; overdue: number };
export type PaymentTotals = { paid: number; due: number; overdue: number };
export type RequestPayments = { items: PaymentItem[]; summary: PaymentSummary };
