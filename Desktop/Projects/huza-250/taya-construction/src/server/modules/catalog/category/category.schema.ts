// CATEGORY SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { enumParam, listQuery } from "@/server/validation/pagination";
import {
  CATEGORY_TYPES,
  DIVISIONS,
  hasChanges,
  id,
  optionalImage,
  optionalText,
  requiredText,
  slugField,
  sortOrder,
} from "../catalog.fields";

const fields = {
  name: requiredText(2, 80),
  slug: slugField,
  type: z.enum(CATEGORY_TYPES),
  division: z.enum(DIVISIONS),
  description: optionalText(500),
  image: optionalImage,
  order: sortOrder,
};

export const createCategorySchema = z.strictObject(fields);

export const updateCategorySchema = z
  .strictObject({
    id,
    name: fields.name.optional(),
    slug: fields.slug,
    type: fields.type.optional(),
    division: fields.division.optional(),
    description: fields.description,
    image: optionalImage.optional(),
    order: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const categoryIdSchema = z.strictObject({ id });

// Read schemas are lenient: a bad URL param falls back to its default.
export const listCategoriesSchema = listQuery.extend({
  type: enumParam(CATEGORY_TYPES),
  division: enumParam(DIVISIONS),
});
export const getCategorySchema = z.object({ id });
export const getCategoryBySlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
export const getCategoriesByTypeSchema = z.object({ type: z.enum(CATEGORY_TYPES) });
export const getCategoriesByDivisionSchema = z.object({ division: z.enum(DIVISIONS) });

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type CreateCategoryData = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type UpdateCategoryData = z.output<typeof updateCategorySchema>;
export type CategoryIdData = z.output<typeof categoryIdSchema>;
export type ListCategoriesData = z.output<typeof listCategoriesSchema>;
