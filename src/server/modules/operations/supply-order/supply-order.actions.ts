"use server";
// SUPPLY ORDER ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { OPS_PATHS } from "../operations.config";
import {
  createSupplyOrderSchema,
  setSupplyOrderHandlerSchema,
  setSupplyOrderStatusSchema,
  submitSupplyOrderSchema,
  updateSupplyOrderSchema,
} from "./supply-order.schema";
import * as supplyOrderService from "./supply-order.service";

const refresh = () => {
  revalidatePath(OPS_PATHS.dashboard, "layout");
};

// PUBLIC: the request sheet for materials.
// Protection: strict schema with `consent: true`; honeypot `fax` (a fake code,
// nothing saved); Turnstile; 5 per minute per hashed IP; the product must be
// available; a stored client is never changed; the reply is { code } only.
export const submitSupplyOrder = createAction({
  access: "public",
  schema: submitSupplyOrderSchema,
  handler: async ({ input }) => {
    const result = await supplyOrderService.submitSupplyOrder(input, await getRequestMeta());
    refresh();
    return result;
  },
});

export const createSupplyOrder = createAction({
  access: "supply-order:create",
  schema: createSupplyOrderSchema,
  handler: async ({ input }) => {
    const row = await supplyOrderService.createSupplyOrder(input);
    refresh();
    return row;
  },
});

export const updateSupplyOrder = createAction({
  access: "supply-order:update",
  schema: updateSupplyOrderSchema,
  handler: async ({ input }) => {
    const row = await supplyOrderService.updateSupplyOrder(input);
    refresh();
    return row;
  },
});

export const setSupplyOrderStatus = createAction({
  access: "supply-order:update",
  schema: setSupplyOrderStatusSchema,
  handler: async ({ input }) => {
    const row = await supplyOrderService.setSupplyOrderStatus(input);
    refresh();
    return row;
  },
});

export const setSupplyOrderHandler = createAction({
  access: "supply-order:update",
  schema: setSupplyOrderHandlerSchema,
  handler: async ({ input }) => {
    const row = await supplyOrderService.setSupplyOrderHandler(input);
    refresh();
    return row;
  },
});
