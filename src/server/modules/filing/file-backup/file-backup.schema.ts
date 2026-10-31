// FILE BACKUP SCHEMA: what input is allowed.
// CLIENT-SAFE: the Backups tab imports this file. No server imports.

import { z } from "zod";
import { listQuery } from "@/server/validation/pagination";
import { folderField } from "../file/file.schema";

export const BACKUP_TYPES = ["FULL", "INCREMENTAL"] as const;

const id = z.string().min(1).max(64);

export const createBackupSchema = z.strictObject({ type: z.enum(BACKUP_TYPES), folder: folderField });
export const backupIdSchema = z.strictObject({ id });

export const listBackupsSchema = listQuery.omit({ cursor: true, q: true }).extend({ cursor: z.string().max(64).optional().catch(undefined) });
export const getBackupSchema = z.object({ id });
export const backupEstimateSchema = z.object({ type: z.enum(BACKUP_TYPES).catch("FULL"), folder: folderField.catch(null) });

export type CreateBackupInput = z.input<typeof createBackupSchema>;
