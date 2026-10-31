// SETTINGS: the single FileSettings row (guide §4.2), created with defaults on
// first access and cached for 60 s. No "server-only": scripts import it.

import { db } from "@/server/validation/db";
import type { FolderRules } from "./folder";

export const DEFAULT_SETTINGS = {
  id: "default",
  maxUploadMb: 20,
  presignExpirySec: 300,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  // Project defaults (docs/complete/filing-module.md): CVs and delivery reports are private.
  folderRules: {
    equipment: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    "equipment-submissions": { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    products: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    services: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    trainings: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    categories: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxMb: 8 },
    "vendor-logos": { mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"], maxMb: 4 }, // staff uploads only
    cvs: { mimeTypes: ["application/pdf"], maxMb: 5, access: "PRIVATE" },
    "delivery-reports": { mimeTypes: ["application/pdf", "image/jpeg", "image/png"], maxMb: 10, access: "PRIVATE" },
  } satisfies FolderRules,
};

export type Settings = {
  maxUploadMb: number;
  allowedMimeTypes: string[];
  folderRules: FolderRules | null;
  presignExpirySec: number;
  updatedAt: Date;
};

const TTL_MS = 60_000;
let cache: { at: number; value: Settings } | null = null;

export const invalidateSettings = () => {
  cache = null;
};

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row =
    (await db.fileSettings.findUnique({ where: { id: "default" } })) ??
    (await db.fileSettings.upsert({ where: { id: "default" }, update: {}, create: DEFAULT_SETTINGS }));
  const value: Settings = {
    maxUploadMb: row.maxUploadMb,
    allowedMimeTypes: row.allowedMimeTypes,
    folderRules: (row.folderRules as FolderRules | null) ?? null,
    presignExpirySec: row.presignExpirySec,
    updatedAt: row.updatedAt,
  };
  cache = { at: Date.now(), value };
  return value;
}
