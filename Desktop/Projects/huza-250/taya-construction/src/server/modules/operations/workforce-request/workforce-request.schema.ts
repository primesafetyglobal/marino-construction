// WORKFORCE REQUEST SCHEMA: what input is allowed (requests and job posts).
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
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
  STAFF_SOURCES,
  WORKFORCE_REQUEST_STATUSES,
} from "../operations.fields";

const item = {
  role: requiredText(2, 120), // "Steel fixer", "Excavator operator"
  quantity: z.coerce.number({ error: "Enter a number." }).int().min(1, "At least 1.").max(1000),
  duration: requiredText(1, 80), // "3 months"
  siteLocation: requiredText(2, 120),
  startDate: optionalDate,
  details: optionalText(2000),
};

// PUBLIC: "Request workers" (OPS-R2, R3, R16).
export const submitWorkforceRequestSchema = z
  .strictObject({ ...item, ...clientContactFields, ...publicFormFields })
  .superRefine(checkClientContact);

export const createWorkforceRequestSchema = z.strictObject({
  ...item,
  clientId: id,
  source: z.enum(STAFF_SOURCES),
  notes: optionalText(4000),
});

export const updateWorkforceRequestSchema = z
  .strictObject({
    id,
    role: item.role.optional(),
    quantity: item.quantity.optional(),
    duration: item.duration.optional(),
    siteLocation: item.siteLocation.optional(),
    startDate: optionalDate.optional(),
    details: item.details,
    jobDescription: optionalText(6000),
    deadline: optionalDate.optional(),
    notes: optionalText(4000),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

// OPS-R11: publishing may set the description and deadline in the same step.
export const publishJobSchema = z.strictObject({
  id,
  jobDescription: optionalText(6000).optional(),
  deadline: optionalDate.optional(),
});
export const workforceRequestIdSchema = z.strictObject({ id });
export const setWorkforceRequestStatusSchema = z.strictObject({ id, status: z.enum(WORKFORCE_REQUEST_STATUSES) });
export const setWorkforceRequestHandlerSchema = z.strictObject({ id, handledById: id.nullable() });

export const listWorkforceRequestsSchema = listQuery.extend({
  status: enumParam(WORKFORCE_REQUEST_STATUSES),
  published: booleanParam,
  handler: handlerParam,
  clientId: uuidParam,
});
export const getWorkforceRequestSchema = z.object({ id });

// Public job posts: a bad number is simply not found.
export const listJobsSchema = listQuery.pick({ cursor: true, limit: true });
export const getJobSchema = z.object({ number: z.coerce.number().int().min(1).max(1_000_000_000) });

export type SubmitWorkforceRequestInput = z.input<typeof submitWorkforceRequestSchema>;
export type SubmitWorkforceRequestData = z.output<typeof submitWorkforceRequestSchema>;
export type CreateWorkforceRequestInput = z.input<typeof createWorkforceRequestSchema>;
export type CreateWorkforceRequestData = z.output<typeof createWorkforceRequestSchema>;
export type UpdateWorkforceRequestInput = z.input<typeof updateWorkforceRequestSchema>;
export type UpdateWorkforceRequestData = z.output<typeof updateWorkforceRequestSchema>;
export type PublishJobData = z.output<typeof publishJobSchema>;
export type WorkforceRequestIdData = z.output<typeof workforceRequestIdSchema>;
export type SetWorkforceRequestStatusData = z.output<typeof setWorkforceRequestStatusSchema>;
export type SetWorkforceRequestHandlerData = z.output<typeof setWorkforceRequestHandlerSchema>;
export type ListWorkforceRequestsData = z.output<typeof listWorkforceRequestsSchema>;
export type ListJobsData = z.output<typeof listJobsSchema>;
