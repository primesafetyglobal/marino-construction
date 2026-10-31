// FILE SCHEMA: what input is allowed.
// CLIENT-SAFE: the upload dialog, useUpload and the admin forms import this file.

import { z } from "zod";
import { dateParam, enumParam, listQuery, textParam } from "@/server/validation/pagination";
import { FOLDER_REGEX, normalizeFolder, UNFILED } from "../lib/folder";

export const FILE_TYPES = ["image", "document", "other"] as const;
export const FILE_STATUSES = ["ACTIVE", "DELETED"] as const;
export const FILE_SORTS = ["uploadedAt", "name", "size"] as const;

const id = z.uuid();
const ids = z.array(id).min(1).max(500);

/** null = unfiled. Same normalization as the server. */
export const folderField = z
  .string()
  .max(200)
  .nullish()
  .transform((v) => normalizeFolder(v))
  .refine((v) => v === null || FOLDER_REGEX.test(v), "Folder: lowercase letters, digits, \"-\" and up to 5 levels separated by \"/\".");

export const fileNameField = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(200)
  .refine((v) => !/[\\/\u0000-\u001f]/.test(v), "The name cannot contain slashes or control characters.");

export const requestUploadSchema = z.strictObject({
  name: fileNameField,
  mimeType: z.string().trim().min(3).max(150),
  size: z.number().int().min(1).max(2_000_000_000),
  folder: folderField,
});

export const confirmUploadSchema = z.strictObject({
  key: z.string().min(3).max(600),
  storageId: z.string().min(1).max(64),
  name: fileNameField,
  folder: folderField,
});

export const moveFilesSchema = z.strictObject({ ids, folder: folderField });
export const renameFileSchema = z.strictObject({ id, name: fileNameField });
export const renameFolderSchema = z
  .strictObject({ from: folderField, to: folderField })
  .refine((v) => v.from && v.to, { message: "Choose both folders." })
  .refine((v) => v.from !== v.to, { message: "The new name is the same." })
  .refine((v) => !v.from || !v.to || !v.to.startsWith(`${v.from}/`), { message: "A folder cannot move into itself." });
export const deleteFilesSchema = z.strictObject({ ids });
export const getAccessUrlSchema = z.strictObject({ id, download: z.boolean().optional() });

// Read schemas are lenient: a bad URL param falls back to its default.
export const listFilesSchema = listQuery.extend({
  folder: z.string().max(200).optional().catch(undefined), // UNFILED = no folder; includes sub-folders
  status: enumParam(FILE_STATUSES),
  storageId: textParam(64),
  type: enumParam(FILE_TYPES),
  from: dateParam,
  to: dateParam,
  sort: enumParam(FILE_SORTS),
  dir: enumParam(["asc", "desc"] as const),
});
export const getFileSchema = z.object({ id });
export const openFileSchema = z.object({
  id,
  download: z.enum(["1", "true"]).optional().catch(undefined),
});

export { UNFILED };

export type RequestUploadInput = z.input<typeof requestUploadSchema>;
export type ConfirmUploadInput = z.input<typeof confirmUploadSchema>;
export type ListFilesData = z.output<typeof listFilesSchema>;
