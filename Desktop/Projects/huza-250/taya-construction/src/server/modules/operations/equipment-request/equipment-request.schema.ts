// EQUIPMENT REQUEST SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.
// status and handler have their own actions; number, source and client are set by the server.

import { z } from "zod";
import { enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import {
  checkClientContact,
  clientContactFields,
  EQUIPMENT_REQUEST_STATUSES,
  EQUIPMENT_REQUEST_TYPES,
  handlerParam,
  hasChanges,
  id,
  optionalDate,
  optionalText,
  publicFormFields,
  requiredText,
  rwf,
  STAFF_SOURCES,
} from "../operations.fields";

// OPS-R5: the end date is not before the start date.
function checkDates(d: { startDate?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) {
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date is before the start date." });
  }
}

const item = {
  equipmentId: id.nullish(),
  type: z.enum(EQUIPMENT_REQUEST_TYPES),
  details: requiredText(3, 2000),
  siteLocation: requiredText(2, 120),
  startDate: optionalDate,
  endDate: optionalDate,
};

// PUBLIC: the request sheet (OPS-R2, R3, R16).
export const submitEquipmentRequestSchema = z
  .strictObject({ ...item, ...clientContactFields, ...publicFormFields })
  .superRefine((d, ctx) => {
    checkDates(d, ctx);
    checkClientContact(d, ctx);
  });

// Staff: phone or walk-in clients (OPS-R3).
export const createEquipmentRequestSchema = z
  .strictObject({ ...item, clientId: id, source: z.enum(STAFF_SOURCES), quotedAmount: rwf.optional(), notes: optionalText(4000) })
  .superRefine(checkDates);

export const updateEquipmentRequestSchema = z
  .strictObject({
    id,
    equipmentId: id.nullish(),
    details: item.details.optional(),
    siteLocation: item.siteLocation.optional(),
    startDate: optionalDate.optional(),
    endDate: optionalDate.optional(),
    quotedAmount: rwf.optional(),
    notes: optionalText(4000),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const setEquipmentRequestStatusSchema = z.strictObject({ id, status: z.enum(EQUIPMENT_REQUEST_STATUSES) });
export const setEquipmentRequestHandlerSchema = z.strictObject({ id, handledById: id.nullable() });

export const listEquipmentRequestsSchema = listQuery.extend({
  status: enumParam(EQUIPMENT_REQUEST_STATUSES),
  type: enumParam(EQUIPMENT_REQUEST_TYPES),
  handler: handlerParam,
  clientId: uuidParam,
});
export const getEquipmentRequestSchema = z.object({ id });
export const rentHistorySchema = z.object({ equipmentId: id });

export type SubmitEquipmentRequestInput = z.input<typeof submitEquipmentRequestSchema>;
export type SubmitEquipmentRequestData = z.output<typeof submitEquipmentRequestSchema>;
export type CreateEquipmentRequestInput = z.input<typeof createEquipmentRequestSchema>;
export type CreateEquipmentRequestData = z.output<typeof createEquipmentRequestSchema>;
export type UpdateEquipmentRequestInput = z.input<typeof updateEquipmentRequestSchema>;
export type UpdateEquipmentRequestData = z.output<typeof updateEquipmentRequestSchema>;
export type SetEquipmentRequestStatusData = z.output<typeof setEquipmentRequestStatusSchema>;
export type SetEquipmentRequestHandlerData = z.output<typeof setEquipmentRequestHandlerSchema>;
export type ListEquipmentRequestsData = z.output<typeof listEquipmentRequestsSchema>;
