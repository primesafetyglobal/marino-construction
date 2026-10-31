// FILE SETTINGS SERVICE: upload limits, allowed types, folder rules, presign expiry.
//
// Rules:
// - SET-R1  a folder rule's types replace the global list for that folder (guide §5.3);
//           its maxMb is capped by maxUploadMb at upload time (uploadPolicy)
// - SET-R2  a PRIVATE folder rule needs an active PRIVATE storage to accept uploads
//           (saved anyway; uploads answer STORAGE_NOT_CONFIGURED until one exists)

import "server-only";
import { db, Prisma } from "@/server/validation/db";
import { getSettings, invalidateSettings } from "../lib/settings";
import type { UpdateSettingsData } from "./file-settings.schema";
import { settingsSelect, toSettingsDto, type SettingsDto } from "./file-settings.select";

export async function readSettings(): Promise<SettingsDto> {
  const s = await getSettings();
  return { maxUploadMb: s.maxUploadMb, allowedMimeTypes: s.allowedMimeTypes, folderRules: s.folderRules, presignExpirySec: s.presignExpirySec, updatedAt: s.updatedAt };
}

// SET-R1.
export async function updateSettings(data: UpdateSettingsData): Promise<SettingsDto> {
  const folderRules = data.folderRules && Object.keys(data.folderRules).length ? data.folderRules : Prisma.DbNull;
  const row = await db.fileSettings.upsert({
    where: { id: "default" },
    update: { maxUploadMb: data.maxUploadMb, allowedMimeTypes: data.allowedMimeTypes, presignExpirySec: data.presignExpirySec, folderRules },
    create: { id: "default", maxUploadMb: data.maxUploadMb, allowedMimeTypes: data.allowedMimeTypes, presignExpirySec: data.presignExpirySec, folderRules },
    select: settingsSelect,
  });
  invalidateSettings();
  return toSettingsDto(row);
}
