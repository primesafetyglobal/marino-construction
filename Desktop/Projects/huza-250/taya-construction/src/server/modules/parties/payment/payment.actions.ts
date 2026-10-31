"use server";
// PAYMENT ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { PARTIES_PATHS } from "../parties.config";
import { createInstallmentPlanSchema, markPaymentPaidSchema, paymentIdSchema, recordPaymentSchema } from "./payment.schema";
import * as paymentService from "./payment.service";

// Payments show on request pages, the payments page and the dashboard.
const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath(PARTIES_PATHS.payments);
};

export const recordPayment = createAction({
  access: "payment:record",
  schema: recordPaymentSchema,
  handler: async ({ input }) => {
    const row = await paymentService.recordPayment(input);
    refresh();
    return row;
  },
});

export const createInstallmentPlan = createAction({
  access: "payment:record",
  schema: createInstallmentPlanSchema,
  handler: async ({ input }) => {
    const result = await paymentService.createInstallmentPlan(input);
    refresh();
    return result;
  },
});

export const markPaymentPaid = createAction({
  access: "payment:record",
  schema: markPaymentPaidSchema,
  handler: async ({ input }) => {
    const row = await paymentService.markPaymentPaid(input);
    refresh();
    return row;
  },
});

export const deletePayment = createAction({
  access: "payment:delete",
  schema: paymentIdSchema,
  handler: async ({ input }) => {
    const row = await paymentService.deletePayment(input);
    refresh();
    return row;
  },
});
