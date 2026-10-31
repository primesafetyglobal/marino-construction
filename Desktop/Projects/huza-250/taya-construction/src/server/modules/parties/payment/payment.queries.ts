// PAYMENT QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { noParams } from "@/server/validation/pagination";
import {
  getPaymentSchema,
  listPaymentsSchema,
  overduePaymentsSchema,
  paymentsByRequestSchema,
  paymentTotalsSchema,
} from "./payment.schema";
import * as paymentService from "./payment.service";

export const listPayments = createQuery({
  access: "payment:read",
  schema: listPaymentsSchema,
  handler: ({ input }) => paymentService.listPayments(input),
});

export const getPayment = createQuery({
  access: "payment:read",
  schema: getPaymentSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await paymentService.getPaymentDetail(input.id);
    if (!row) throw Errors.notFound("Payment");
    return row;
  },
});

// Request detail: payments with paid / outstanding.
export const getPaymentsByRequest = createQuery({
  access: "payment:read",
  schema: paymentsByRequestSchema,
  handler: ({ input }) => paymentService.listPaymentsByRequest(input.requestType, input.requestId),
});

// Dashboard: overdue installments.
export const getOverduePayments = createQuery({
  access: "payment:read",
  schema: overduePaymentsSchema,
  handler: ({ input }) => paymentService.listOverduePayments(input.limit),
});

// Payments page: paid and outstanding totals for the current filter.
export const getPaymentSummary = createQuery({
  access: "payment:read",
  schema: paymentTotalsSchema,
  handler: ({ input }) => paymentService.getPaymentTotals(input),
});

// Dashboard and sidebar counter.
export const getOverdueCount = createQuery({
  access: "payment:read",
  schema: noParams,
  handler: () => paymentService.countOverduePayments(),
});
