// SUPPLY ORDER SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import {
  checkClientContact,
  clientContactFields,
  handlerParam,
  hasChanges,
  id,
  optionalDate,
  optionalText,
  publicFormFields,
  requiredText,
  rwf,
  STAFF_SOURCES,
  SUPPLY_ORDER_STATUSES,
} from "../operations.fields";

const item = {
  productId: id.nullish(),
  items: requiredText(3, 2000), // "50 bags cement, 2 trips sand" (free text in v1)
  deliveryLocation: requiredText(2, 120),
  deliveryDate: optionalDate,
};

// PUBLIC: the request sheet (OPS-R2, R3, R16).
export const submitSupplyOrderSchema = z
  .strictObject({ ...item, ...clientContactFields, ...publicFormFields })
  .superRefine(checkClientContact);

export const createSupplyOrderSchema = z.strictObject({
  ...item,
  clientId: id,
  source: z.enum(STAFF_SOURCES),
  vendorId: id.nullish(),
  quotedAmount: rwf.optional(),
  notes: optionalText(4000),
});

export const updateSupplyOrderSchema = z
  .strictObject({
    id,
    productId: id.nullish(),
    vendorId: id.nullish(),
    items: item.items.optional(),
    deliveryLocation: item.deliveryLocation.optional(),
    deliveryDate: optionalDate.optional(),
    quotedAmount: rwf.optional(),
    notes: optionalText(4000),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const setSupplyOrderStatusSchema = z.strictObject({ id, status: z.enum(SUPPLY_ORDER_STATUSES) });
export const setSupplyOrderHandlerSchema = z.strictObject({ id, handledById: id.nullable() });

export const listSupplyOrdersSchema = listQuery.extend({
  status: enumParam(SUPPLY_ORDER_STATUSES),
  handler: handlerParam,
  clientId: uuidParam,
});
export const getSupplyOrderSchema = z.object({ id });

export type SubmitSupplyOrderInput = z.input<typeof submitSupplyOrderSchema>;
export type SubmitSupplyOrderData = z.output<typeof submitSupplyOrderSchema>;
export type CreateSupplyOrderInput = z.input<typeof createSupplyOrderSchema>;
export type CreateSupplyOrderData = z.output<typeof createSupplyOrderSchema>;
export type UpdateSupplyOrderInput = z.input<typeof updateSupplyOrderSchema>;
export type UpdateSupplyOrderData = z.output<typeof updateSupplyOrderSchema>;
export type SetSupplyOrderStatusData = z.output<typeof setSupplyOrderStatusSchema>;
export type SetSupplyOrderHandlerData = z.output<typeof setSupplyOrderHandlerSchema>;
export type ListSupplyOrdersData = z.output<typeof listSupplyOrdersSchema>;
