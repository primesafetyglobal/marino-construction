// PRODUCT SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery, textParam } from "@/server/validation/pagination";
import { hasChanges, id, imageList, optionalText, PRODUCT_UNITS, requiredText, rwf, slugField } from "../catalog.fields";

const fields = {
  categoryId: id,
  supplierId: id.nullish(),
  name: requiredText(2, 120),
  slug: slugField,
  description: requiredText(10, 4000),
  images: imageList.default([]),
  brand: optionalText(80),
  price: rwf.optional(), // empty = "Request a quote"
  unit: z.enum(PRODUCT_UNITS),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
};

export const createProductSchema = z.strictObject(fields);

export const updateProductSchema = z
  .strictObject({
    id,
    categoryId: id.optional(),
    supplierId: id.nullish(),
    name: fields.name.optional(),
    slug: fields.slug,
    description: fields.description.optional(),
    images: imageList.optional(),
    brand: fields.brand,
    price: rwf.optional(),
    unit: fields.unit.optional(),
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const productIdSchema = z.strictObject({ id });

export const listProductsSchema = listQuery.extend({
  view: enumParam(["public"]), // public pages force the public select, even for signed-in staff
  category: textParam(120),
  featured: booleanParam,
  available: booleanParam,
});
export const getProductSchema = z.object({ id });
export const getProductBySlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
export const featuredProductsSchema = z.object({ limit: z.coerce.number().int().min(1).max(24).default(12).catch(12) });

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductData = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type UpdateProductData = z.output<typeof updateProductSchema>;
export type ProductIdData = z.output<typeof productIdSchema>;
export type ListProductsData = z.output<typeof listProductsSchema>;
