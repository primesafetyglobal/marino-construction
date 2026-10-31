// FILE STORAGE SCHEMA: what input is allowed.
// CLIENT-SAFE: the storage form imports this file. No server imports.

import { z } from "zod";
import { noParams } from "@/server/validation/pagination";

export const STORAGE_ACCESS = ["PUBLIC", "PRIVATE"] as const;

const id = z.string().min(1).max(64);
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((v) => (v ? v.replace(/\/+$/, "") : null))
  .refine((v) => v === null || /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(v), "Enter a full URL starting with https://.");

const fields = {
  name: z.string().trim().min(2, "Name is required.").max(80),
  endpoint: optionalUrl,
  region: z.string().trim().min(1, "Region is required (\"auto\" for R2).").max(40),
  bucket: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Bucket: 3-63 lowercase letters, digits, \".\" or \"-\"."),
  prefix: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Prefix: lowercase letters, digits and \"-\", no slashes.").max(60),
  forcePathStyle: z.boolean().default(false),
  accessKeyId: z.string().trim().min(4, "Access key id is required.").max(200),
  publicBaseUrl: optionalUrl,
  access: z.enum(STORAGE_ACCESS).default("PUBLIC"),
};

export const createStorageSchema = z.strictObject({
  ...fields,
  secretAccessKey: z.string().min(8, "Secret access key is required.").max(300),
});

// Blank secret = keep the stored one (write-only field).
export const updateStorageSchema = z.strictObject({
  id,
  name: fields.name.optional(),
  endpoint: fields.endpoint.optional(),
  region: fields.region.optional(),
  bucket: fields.bucket.optional(),
  prefix: fields.prefix.optional(),
  forcePathStyle: z.boolean().optional(),
  accessKeyId: fields.accessKeyId.optional(),
  secretAccessKey: z.string().max(300).optional().transform((v) => v || undefined),
  access: z.enum(STORAGE_ACCESS).optional(),
});

export const storageIdSchema = z.strictObject({ id });

// Irreversible: the admin types the storage name.
export const confirmStorageSchema = z.strictObject({ id, confirmName: z.string().trim().min(1, "Type the storage name.") });

export const listStoragesSchema = noParams;
export const getStorageSchema = z.object({ id });

export type CreateStorageInput = z.input<typeof createStorageSchema>;
export type CreateStorageData = z.output<typeof createStorageSchema>;
export type UpdateStorageInput = z.input<typeof updateStorageSchema>;
export type UpdateStorageData = z.output<typeof updateStorageSchema>;
