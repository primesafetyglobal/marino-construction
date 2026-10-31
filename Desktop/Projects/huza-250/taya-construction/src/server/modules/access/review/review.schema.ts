// REVIEW SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.
// Staff never edit the visitor's words: only the status has an action (ACC-R13).

import { z } from "zod";
import { enumParam, intParam, listQuery } from "@/server/validation/pagination";
import { DIVISIONS, id, optionalEmail, optionalPhone, optionalText, publicFormFields, requiredText, REVIEW_STATUSES } from "../access.fields";

// PUBLIC "Share your experience" (ACC-R13, R14, R15).
export const submitReviewSchema = z.strictObject({
  fullName: requiredText(2, 120),
  company: optionalText(160),
  phone: optionalPhone,
  email: optionalEmail,
  division: z.enum(DIVISIONS).nullish(),
  rating: z.coerce.number().int().min(1, "Choose 1 to 5 stars.").max(5, "Choose 1 to 5 stars."),
  message: requiredText(5, 2000),
  ...publicFormFields,
});

export const setReviewStatusSchema = z.strictObject({ id, status: z.enum(["PUBLIC", "PRIVATE"]) });
export const reviewIdSchema = z.strictObject({ id });

export const listReviewsSchema = listQuery.extend({
  status: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(REVIEW_STATUSES))
    .optional()
    .catch(undefined),
  rating: intParam,
});
export const getReviewSchema = z.object({ id });
export const publicReviewsSchema = listQuery.pick({ cursor: true, limit: true }).extend({ division: enumParam(DIVISIONS) });
export const reviewSummarySchema = z.object({ division: enumParam(DIVISIONS) });
export const noInput = z.object({});

export type SubmitReviewInput = z.input<typeof submitReviewSchema>;
export type SubmitReviewData = z.output<typeof submitReviewSchema>;
export type SetReviewStatusData = z.output<typeof setReviewStatusSchema>;
export type ReviewIdData = z.output<typeof reviewIdSchema>;
export type ListReviewsData = z.output<typeof listReviewsSchema>;
export type PublicReviewsData = z.output<typeof publicReviewsSchema>;
