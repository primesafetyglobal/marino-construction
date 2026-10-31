// TRAINING SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery } from "@/server/validation/pagination";
import { hasChanges, httpsUrl, id, optionalImage, optionalText, requiredText, slugField, TRAINING_TYPES } from "../catalog.fields";

const fields = {
  title: requiredText(2, 140),
  slug: slugField,
  summary: requiredText(5, 400),
  image: optionalImage,
  type: z.enum(TRAINING_TYPES),
  duration: optionalText(40),
  externalUrl: httpsUrl, // CAT-R11: course page on Prime Safety Global
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
};

export const createTrainingSchema = z.strictObject(fields);

export const updateTrainingSchema = z
  .strictObject({
    id,
    title: fields.title.optional(),
    slug: fields.slug,
    summary: fields.summary.optional(),
    image: optionalImage.optional(),
    type: fields.type.optional(),
    duration: fields.duration,
    externalUrl: httpsUrl.optional(),
    isFeatured: z.boolean().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const trainingIdSchema = z.strictObject({ id });

export const listTrainingsSchema = listQuery.extend({
  type: enumParam(TRAINING_TYPES),
  published: booleanParam,
  view: enumParam(["public"]), // public pages force the public select, even for signed-in staff
});
export const getTrainingSchema = z.object({ id });
export const publishedTrainingsSchema = z.object({ type: enumParam(TRAINING_TYPES) });
export const featuredTrainingsSchema = z.object({ limit: z.coerce.number().int().min(1).max(24).default(8).catch(8) });

export type CreateTrainingInput = z.input<typeof createTrainingSchema>;
export type CreateTrainingData = z.output<typeof createTrainingSchema>;
export type UpdateTrainingInput = z.input<typeof updateTrainingSchema>;
export type UpdateTrainingData = z.output<typeof updateTrainingSchema>;
export type TrainingIdData = z.output<typeof trainingIdSchema>;
export type ListTrainingsData = z.output<typeof listTrainingsSchema>;
