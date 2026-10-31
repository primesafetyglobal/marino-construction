// EQUIPMENT SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.
//
// Status is not part of create / update: it moves only through
// setEquipmentStatus, approveEquipment and request side effects (CAT-R12).

import { z } from "zod";
import { booleanParam, enumParam, listQuery, textParam, uuidParam } from "@/server/validation/pagination";
import { CATALOG_CONFIG } from "../catalog.config";
import {
  checkVendorContact,
  EQUIPMENT_STATUSES,
  hasChanges,
  id,
  imageList,
  publicFormFields,
  RENT_UNITS,
  requiredText,
  rwf,
  slugField,
  vendorContactFields,
} from "../catalog.fields";

// CAT-R5: at most 20 label / value rows, both required.
export const specsSchema = z
  .array(z.strictObject({ label: requiredText(1, 40), value: requiredText(1, 80) }))
  .max(CATALOG_CONFIG.limits.specsRows, "At most 20 rows.");

const pricing = {
  forRent: z.boolean(),
  rentPrice: rwf.optional(),
  rentUnit: z.enum(RENT_UNITS).nullish(),
  forSale: z.boolean(),
  salePrice: rwf.optional(),
};

type Pricing = { forRent?: boolean; forSale?: boolean; rentPrice?: number | null; rentUnit?: string | null };

// CAT-R5: for rent and/or sale; a rent price needs a unit.
export function checkPricing(d: Pricing, ctx: z.RefinementCtx) {
  if (!d.forRent && !d.forSale) ctx.addIssue({ code: "custom", path: ["forRent"], message: "Choose rent, sale or both." });
  if (d.rentPrice && !d.rentUnit) ctx.addIssue({ code: "custom", path: ["rentUnit"], message: "Choose a rent unit." });
}

const fields = {
  categoryId: id,
  ownerId: id.nullish(),
  name: requiredText(2, 120),
  slug: slugField,
  description: requiredText(10, 4000),
  images: imageList.default([]),
  specs: specsSchema.default([]),
  location: requiredText(2, 80),
  ...pricing,
  isFeatured: z.boolean().default(false),
};

export const createEquipmentSchema = z.strictObject(fields).superRefine(checkPricing);

export const updateEquipmentSchema = z
  .strictObject({
    id,
    categoryId: id.optional(),
    ownerId: id.nullish(),
    name: fields.name.optional(),
    slug: fields.slug,
    description: fields.description.optional(),
    images: imageList.optional(),
    specs: specsSchema.optional(),
    location: fields.location.optional(),
    forRent: z.boolean().optional(),
    rentPrice: rwf.optional(),
    rentUnit: z.enum(RENT_UNITS).nullish(),
    forSale: z.boolean().optional(),
    salePrice: rwf.optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

// Manual status changes by staff. RENTED comes only from an ACTIVE rental.
export const MANUAL_EQUIPMENT_STATUSES = ["AVAILABLE", "SOLD", "INACTIVE"] as const;
export const setEquipmentStatusSchema = z.strictObject({ id, status: z.enum(MANUAL_EQUIPMENT_STATUSES) });

export const equipmentIdSchema = z.strictObject({ id });

// PUBLIC "Rent out / sell your equipment" form (CAT-R7, CAT-R13).
export const submitEquipmentSchema = z
  .strictObject({
    categoryId: id,
    name: fields.name,
    description: fields.description,
    images: z.array(z.string().startsWith("upload:").max(4000)).max(10).default([]),
    specs: specsSchema.default([]),
    location: fields.location,
    ...pricing,
    ...vendorContactFields,
    ...publicFormFields,
  })
  .superRefine((d, ctx) => {
    checkPricing(d, ctx);
    checkVendorContact(d, ctx);
  });

export const UPLOAD_KINDS = ["equipment", "product", "service", "training", "category"] as const;
export const uploadTicketSchema = z.strictObject({
  kind: z.enum(UPLOAD_KINDS),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});
export const publicUploadTicketSchema = z.strictObject({
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

// Read schemas are lenient.
export const listEquipmentSchema = listQuery.extend({
  view: enumParam(["public"]), // public pages force the public select, even for signed-in staff
  category: textParam(120),
  mode: enumParam(["rent", "sale"]),
  location: textParam(80),
  status: enumParam(EQUIPMENT_STATUSES),
  featured: booleanParam,
  ownerId: uuidParam,
});
export const getEquipmentSchema = z.object({ id });
export const getEquipmentBySlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
export const featuredSchema = z.object({ limit: z.coerce.number().int().min(1).max(24).default(12).catch(12) });

export type CreateEquipmentInput = z.input<typeof createEquipmentSchema>;
export type CreateEquipmentData = z.output<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.input<typeof updateEquipmentSchema>;
export type UpdateEquipmentData = z.output<typeof updateEquipmentSchema>;
export type SetEquipmentStatusData = z.output<typeof setEquipmentStatusSchema>;
export type EquipmentIdData = z.output<typeof equipmentIdSchema>;
export type SubmitEquipmentInput = z.input<typeof submitEquipmentSchema>;
export type SubmitEquipmentData = z.output<typeof submitEquipmentSchema>;
export type ListEquipmentData = z.output<typeof listEquipmentSchema>;
export type UploadTicketData = z.output<typeof uploadTicketSchema>;
