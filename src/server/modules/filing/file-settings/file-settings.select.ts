// FILE SETTINGS SELECT: the single settings row (id "default").

import type { Prisma } from "@/server/validation/db";
import type { FolderRules } from "../lib/folder";

export const settingsSelect = {
  maxUploadMb: true,
  allowedMimeTypes: true,
  folderRules: true,
  presignExpirySec: true,
  updatedAt: true,
} satisfies Prisma.FileSettingsSelect;

type Row = Prisma.FileSettingsGetPayload<{ select: typeof settingsSelect }>;

export type SettingsDto = Omit<Row, "folderRules"> & { folderRules: FolderRules | null };

export const toSettingsDto = (r: Row): SettingsDto => ({ ...r, folderRules: (r.folderRules as FolderRules | null) ?? null });
