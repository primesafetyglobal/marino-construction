// SERVICE SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import { CATALOG_CONFIG } from "../catalog.config";
import { DIVISIONS, hasChanges, id, optionalImage, requiredText, slugField, sortOrder } from "../catalog.fields";

const title = requiredText(1, 120);
const items = z.array(requiredText(1, 300)).min(1, "Add at least one item.").max(30);

// CAT-R10: the page sections of a service, rendered in order.
export const contentSectionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), title, body: requiredText(1, 4000) }),
  z.strictObject({ type: z.literal("list"), title, items }),
  z.strictObject({ type: z.literal("steps"), title, items }),
  z.strictObject({
    type: z.literal("faq"),
    title,
    items: z.array(z.strictObject({ q: requiredText(1, 300), a: requiredText(1, 2000) })).min(1).max(20),
  }),
]);
export const contentSchema = z.array(contentSectionSchema).max(CATALOG_CONFIG.limits.contentSections, "At most 10 sections.");
export type ContentSection = z.output<typeof contentSectionSchema>;

const fields = {
  categoryId: id,
  name: requiredText(2, 120),
  slug: slugField,
  summary: requiredText(5, 200),
  description: requiredText(10, 4000),
  content: contentSchema.default([]),
  image: optionalImage,
  order: sortOrder,
  isActive: z.boolean().default(true),
};

export const createServiceSchema = z.strictObject(fields);

export const updateServiceSchema = z
  .strictObject({
    id,
    categoryId: id.optional(),
    name: fields.name.optional(),
    slug: fields.slug,
    summary: fields.summary.optional(),
    description: fields.description.optional(),
    content: contentSchema.optional(),
    image: optionalImage.optional(),
    order: z.coerce.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const serviceIdSchema = z.strictObject({ id });

export const listServicesSchema = listQuery.extend({
  view: enumParam(["public"]), // public pages force the public select, even for signed-in staff
  division: enumParam(DIVISIONS),
  categoryId: uuidParam,
  active: booleanParam,
});
export const getServiceSchema = z.object({ id });
export const getServiceBySlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
export const servicesByDivisionSchema = z.object({ division: z.enum(DIVISIONS) });
export const featuredServicesSchema = z.object({
  division: z.enum(DIVISIONS).default("INSPECTION_TESTING").catch("INSPECTION_TESTING"),
  limit: z.coerce.number().int().min(1).max(24).default(6).catch(6),
});

export type CreateServiceInput = z.input<typeof createServiceSchema>;
export type CreateServiceData = z.output<typeof createServiceSchema>;
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;
export type UpdateServiceData = z.output<typeof updateServiceSchema>;
export type ServiceIdData = z.output<typeof serviceIdSchema>;
export type ListServicesData = z.output<typeof listServicesSchema>;
