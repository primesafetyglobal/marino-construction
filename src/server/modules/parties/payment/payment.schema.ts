// PAYMENT SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import { PARTIES_CONFIG } from "../parties.config";
import { dateOnly, id, optionalDateOnly, optionalText, PAYABLE_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, rwf } from "../parties.fields";

// PTY-R9: one request, named by its type and id. PTY-R10: PAID needs a method.
export const recordPaymentSchema = z
  .strictObject({
    requestType: z.enum(PAYABLE_TYPES),
    requestId: id,
    amount: rwf,
    status: z.enum(PAYMENT_STATUSES).default("PAID"),
    method: z.enum(PAYMENT_METHODS).nullish(),
    dueDate: optionalDateOnly,
    paidAt: optionalDateOnly,
    reference: optionalText(120),
  })
  .superRefine((d, ctx) => {
    if (d.status === "PAID" && !d.method) ctx.addIssue({ code: "custom", path: ["method"], message: "Choose how it was paid." });
    if (d.status === "DUE" && !d.dueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Choose a due date." });
  });

// PTY-R11: several DUE payments with dates.
export const createInstallmentPlanSchema = z.strictObject({
  serviceRequestId: id,
  installments: z
    .array(z.strictObject({ amount: rwf, dueDate: dateOnly }))
    .min(PARTIES_CONFIG.installments.min, `At least ${PARTIES_CONFIG.installments.min} installments.`)
    .max(PARTIES_CONFIG.installments.max, `At most ${PARTIES_CONFIG.installments.max} installments.`),
});

export const markPaymentPaidSchema = z.strictObject({
  id,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  paidAt: optionalDateOnly,
});

export const paymentIdSchema = z.strictObject({ id });

export const listPaymentsSchema = listQuery.extend({
  status: enumParam(PAYMENT_STATUSES),
  overdue: booleanParam,
  requestId: uuidParam,
});
export const getPaymentSchema = z.object({ id });
export const paymentsByRequestSchema = z.object({ requestType: z.enum(PAYABLE_TYPES), requestId: id });
export const overduePaymentsSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20).catch(20) });
export const paymentTotalsSchema = z.object({ status: enumParam(PAYMENT_STATUSES), overdue: booleanParam });

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type RecordPaymentData = z.output<typeof recordPaymentSchema>;
export type CreateInstallmentPlanInput = z.input<typeof createInstallmentPlanSchema>;
export type CreateInstallmentPlanData = z.output<typeof createInstallmentPlanSchema>;
export type MarkPaymentPaidInput = z.input<typeof markPaymentPaidSchema>;
export type MarkPaymentPaidData = z.output<typeof markPaymentPaidSchema>;
export type PaymentIdData = z.output<typeof paymentIdSchema>;
export type ListPaymentsData = z.output<typeof listPaymentsSchema>;
