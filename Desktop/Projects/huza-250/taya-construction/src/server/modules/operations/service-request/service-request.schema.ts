// SERVICE REQUEST SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import {
  checkClientContact,
  clientContactFields,
  DIVISIONS,
  handlerParam,
  hasChanges,
  id,
  optionalDate,
  optionalText,
  PAYMENT_PLANS,
  publicFormFields,
  requiredText,
  rwf,
  SERVICE_REQUEST_STATUSES,
  STAFF_SOURCES,
} from "../operations.fields";

const item = {
  serviceId: id,
  details: requiredText(3, 2000),
  siteLocation: requiredText(2, 120),
  preferredDate: optionalDate,
  paymentPlan: z.enum(PAYMENT_PLANS).default("FULL"), // "Pay in installments" (Paint Rwanda)
};

// PUBLIC: the request sheet (OPS-R2, R3, R16).
export const submitServiceRequestSchema = z
  .strictObject({ ...item, ...clientContactFields, ...publicFormFields })
  .superRefine(checkClientContact);

export const createServiceRequestSchema = z.strictObject({
  ...item,
  clientId: id,
  source: z.enum(STAFF_SOURCES),
  vendorId: id.nullish(),
  quotedAmount: rwf.optional(),
  notes: optionalText(4000),
});

// deliveryReport: text, or "upload:<token>" of a report file.
export const updateServiceRequestSchema = z
  .strictObject({
    id,
    vendorId: id.nullish(),
    details: item.details.optional(),
    siteLocation: item.siteLocation.optional(),
    preferredDate: optionalDate.optional(),
    quotedAmount: rwf.optional(),
    paymentPlan: z.enum(PAYMENT_PLANS).optional(),
    deliveryReport: optionalText(4000),
    notes: optionalText(4000),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const setServiceRequestStatusSchema = z.strictObject({ id, status: z.enum(SERVICE_REQUEST_STATUSES) });
export const setServiceRequestHandlerSchema = z.strictObject({ id, handledById: id.nullable() });
export const reportUploadTicketSchema = z.strictObject({ mimeType: z.string().max(100), sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024) });

export const listServiceRequestsSchema = listQuery.extend({
  status: enumParam(SERVICE_REQUEST_STATUSES),
  division: enumParam(DIVISIONS),
  service: uuidParam,
  handler: handlerParam,
  clientId: uuidParam,
});
export const getServiceRequestSchema = z.object({ id });

export type SubmitServiceRequestInput = z.input<typeof submitServiceRequestSchema>;
export type SubmitServiceRequestData = z.output<typeof submitServiceRequestSchema>;
export type CreateServiceRequestInput = z.input<typeof createServiceRequestSchema>;
export type CreateServiceRequestData = z.output<typeof createServiceRequestSchema>;
export type UpdateServiceRequestInput = z.input<typeof updateServiceRequestSchema>;
export type UpdateServiceRequestData = z.output<typeof updateServiceRequestSchema>;
export type SetServiceRequestStatusData = z.output<typeof setServiceRequestStatusSchema>;
export type SetServiceRequestHandlerData = z.output<typeof setServiceRequestHandlerSchema>;
export type ListServiceRequestsData = z.output<typeof listServiceRequestsSchema>;
