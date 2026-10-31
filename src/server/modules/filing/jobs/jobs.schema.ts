// JOBS SCHEMA: what input is allowed for import, checks, fixes and migration.
// CLIENT-SAFE: the Health and Storage pages import this file. No server imports.

import { z } from "zod";
import { noParams } from "@/server/validation/pagination";

const storageId = z.string().min(1).max(64);
const reportName = z.string().regex(/^\d{4}-\d{2}-\d{2}_[A-Z_]+_[\w-]+\.json$/, "Invalid report name.");

export const CHECK_TYPES = ["NORMALIZE", "REFERENCE_CHECK", "DISCOVERY", "STORAGE_CHECK"] as const;
export const FIX_CATEGORIES = ["nonCanonical", "query", "readOnly", "missing", "unregistered"] as const;

export const runImportSchema = z.strictObject({ storageId, dryRun: z.boolean().default(true) });

export const runCheckSchema = z
  .strictObject({ type: z.enum(CHECK_TYPES), storageId: storageId.optional(), dryRun: z.boolean().default(true) })
  .refine((v) => v.type !== "STORAGE_CHECK" || !!v.storageId, { message: "Choose a storage.", path: ["storageId"] });

export const applyFixesSchema = z.strictObject({
  reportName,
  categories: z.array(z.enum(FIX_CATEGORIES)).min(1, "Choose at least one fix."),
  dryRun: z.boolean().default(false),
});

export const applyStorageFixesSchema = z
  .strictObject({ reportName, markMissing: z.boolean().default(false), fixSizes: z.boolean().default(false), dryRun: z.boolean().default(false) })
  .refine((v) => v.markMissing || v.fixSizes, { message: "Choose at least one fix." });

export const deleteAbandonedSchema = z.strictObject({ reportName, keys: z.array(z.string().min(3).max(600)).max(10_000).optional() });

export const markFalsePositivesSchema = z.strictObject({ reportName, columns: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/)).min(1).max(500) });

export const changeBaseUrlSchema = z.strictObject({
  storageId,
  publicBaseUrl: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v ? v.replace(/\/+$/, "") : null))
    .refine((v) => v === null || /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(v), "Enter a full URL starting with https://."),
  imageHostConfirmed: z.literal(true, { error: "Confirm the new host is allowed in next.config and deployed." }),
  dryRun: z.boolean().default(true),
});

export const migrationPrecheckSchema = z.object({ sourceId: storageId, targetId: storageId });
export const startMigrationSchema = z.strictObject({ sourceId: storageId, targetId: storageId, skipBackup: z.boolean().default(false) });
export const migrationSourceSchema = z.strictObject({ sourceId: storageId });
export const markMissingSchema = z.strictObject({ sourceId: storageId, keys: z.array(z.string().min(3).max(600)).min(1).max(10_000) });
export const purgeStorageSchema = z.strictObject({
  sourceId: storageId,
  confirmName: z.string().trim().min(1, "Type the storage name."),
  deleteBackups: z.boolean().default(false),
});

export const currentJobSchema = noParams;
export const listReportsSchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100).catch(100) });
export const getReportSchema = z.object({ name: reportName });
export const migrationStateSchema = noParams;
