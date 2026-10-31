// FILE BACKUP QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { backupEstimateSchema, getBackupSchema, listBackupsSchema } from "./file-backup.schema";
import * as backupService from "./file-backup.service";

export const listBackups = createQuery({
  access: "file-backup:read",
  schema: listBackupsSchema,
  handler: ({ input }) => backupService.listBackups(input),
});

export const getBackup = createQuery({
  access: "file-backup:read",
  schema: getBackupSchema,
  onInvalid: "not-found",
  handler: ({ input }) => backupService.getBackup(input.id),
});

export const getBackupEstimate = createQuery({
  access: "file-backup:read",
  schema: backupEstimateSchema,
  handler: ({ input }) => backupService.estimate(input),
});

// The route answers with a 302 to a 5-minute presigned download.
export const getBackupDownload = createQuery({
  access: "file-backup:read",
  schema: getBackupSchema,
  onInvalid: "not-found",
  handler: ({ input }) => backupService.downloadUrl(input.id),
});
