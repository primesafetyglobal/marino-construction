// SUPPLY ORDER QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getSupplyOrderSchema, listSupplyOrdersSchema } from "./supply-order.schema";
import * as supplyOrderService from "./supply-order.service";

export const listSupplyOrders = createQuery({
  access: "supply-order:read",
  schema: listSupplyOrdersSchema,
  handler: ({ input, user }) => supplyOrderService.listSupplyOrders(input, { actor: user }),
});

export const getSupplyOrder = createQuery({
  access: "supply-order:read",
  schema: getSupplyOrderSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await supplyOrderService.getSupplyOrderDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Order");
    return row;
  },
});
