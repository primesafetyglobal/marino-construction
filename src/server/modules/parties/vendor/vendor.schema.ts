// VENDOR SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.
//
// status and isPartner are not in create / update: each has its own action.

import { z } from "zod";
import { booleanParam, enumParam, listQuery, textParam } from "@/server/validation/pagination";
import {
  checkCompany,
  checkPhoneOrEmail,
  hasChanges,
  id,
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUrl,
  PARTY_TYPES,
  publicFormFields,
  requiredText,
  tin,
  VENDOR_STATUSES,
  VENDOR_TYPES,
} from "../parties.fields";

const logo = z
  .string()
  .trim()
  .max(4000)
  .refine((v) => v === "" || v.startsWith("upload:") || /^https:\/\/\S+$/.test(v), "Invalid logo.")
  .nullish()
  .transform((v) => (v ? v : null));

const fields = {
  name: requiredText(2, 120),
  phone: optionalPhone,
  email: optionalEmail,
  type: z.enum(VENDOR_TYPES),
  entityType: z.enum(PARTY_TYPES).default("INDIVIDUAL"),
  companyName: optionalText(160),
  tin,
  district: optionalText(80),
  offerings: requiredText(3, 2000),
  logo,
  website: optionalUrl,
  notes: optionalText(4000),
};

export const createVendorSchema = z.strictObject(fields).superRefine((d, ctx) => {
  checkPhoneOrEmail(d, ctx);
  checkCompany(d, ctx);
});

export const updateVendorSchema = z
  .strictObject({
    id,
    name: fields.name.optional(),
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    type: fields.type.optional(),
    entityType: z.enum(PARTY_TYPES).optional(),
    companyName: fields.companyName,
    tin: fields.tin.optional(),
    district: fields.district,
    offerings: fields.offerings.optional(),
    logo: fields.logo.optional(),
    website: fields.website,
    notes: fields.notes,
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const setVendorStatusSchema = z.strictObject({ id, status: z.enum(["APPROVED", "INACTIVE"]) });
export const setVendorPartnerSchema = z.strictObject({ id, isPartner: z.boolean() });
export const vendorIdSchema = z.strictObject({ id });

// PUBLIC "Partner with us" form (PTY-R3, PTY-R15).
export const submitVendorSchema = z
  .strictObject({
    returning: z.boolean(),
    phone: optionalPhone,
    email: optionalEmail,
    name: optionalText(120),
    type: z.enum(VENDOR_TYPES).default("OTHER"),
    entityType: z.enum(PARTY_TYPES).default("INDIVIDUAL"),
    companyName: optionalText(160),
    tin,
    district: optionalText(80),
    offerings: optionalText(2000),
    ...publicFormFields,
  })
  .superRefine((d, ctx) => {
    checkPhoneOrEmail(d, ctx);
    if (d.returning) return;
    if (!d.name || d.name.length < 2) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter your name." });
    if (!d.offerings || d.offerings.length < 3) ctx.addIssue({ code: "custom", path: ["offerings"], message: "Tell us what you offer." });
    checkCompany(d, ctx);
  });

export const partiesUploadTicketSchema = z.strictObject({
  kind: z.enum(["logo", "cv"]),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

export const listVendorsSchema = listQuery.extend({
  type: enumParam(VENDOR_TYPES),
  status: enumParam(VENDOR_STATUSES),
  district: textParam(80),
  partner: booleanParam,
});
export const getVendorSchema = z.object({ id });
export const partnersSchema = z.object({});

export type CreateVendorInput = z.input<typeof createVendorSchema>;
export type CreateVendorData = z.output<typeof createVendorSchema>;
export type UpdateVendorInput = z.input<typeof updateVendorSchema>;
export type UpdateVendorData = z.output<typeof updateVendorSchema>;
export type SetVendorStatusData = z.output<typeof setVendorStatusSchema>;
export type SetVendorPartnerData = z.output<typeof setVendorPartnerSchema>;
export type VendorIdData = z.output<typeof vendorIdSchema>;
export type SubmitVendorInput = z.input<typeof submitVendorSchema>;
export type SubmitVendorData = z.output<typeof submitVendorSchema>;
export type ListVendorsData = z.output<typeof listVendorsSchema>;
