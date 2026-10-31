// FILE SETTINGS SCHEMA: what input is allowed.
// CLIENT-SAFE: the settings form imports this file. No server imports.

import { z } from "zod";
import { noParams } from "@/server/validation/pagination";
import { FOLDER_REGEX } from "../lib/folder";

const mimeType = z.string().trim().toLowerCase().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/, "Use a MIME type such as image/png.");

export const folderRuleSchema = z.strictObject({
  mimeTypes: z.array(mimeType).min(1).max(50).optional(),
  maxMb: z.number().int().min(1).max(2000).optional(),
  access: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export const updateSettingsSchema = z.strictObject({
  maxUploadMb: z.number().int().min(1, "At least 1 MB.").max(2000),
  allowedMimeTypes: z.array(mimeType).min(1, "Allow at least one type.").max(100),
  presignExpirySec: z.number().int().min(60, "At least 60 seconds.").max(7 * 24 * 3600),
  folderRules: z
    .record(z.string().regex(FOLDER_REGEX, "Folder: lowercase letters, digits, \"-\" and \"/\"."), folderRuleSchema)
    .nullable()
    .refine((r) => !r || Object.keys(r).length <= 200, "At most 200 folder rules."),
});

export const getSettingsSchema = noParams;

export type UpdateSettingsInput = z.input<typeof updateSettingsSchema>;
export type UpdateSettingsData = z.output<typeof updateSettingsSchema>;
