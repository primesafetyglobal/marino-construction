// FILE QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { noParams } from "@/server/validation/pagination";
import { FilingError } from "../lib/errors";
import { getFileSchema, listFilesSchema, openFileSchema } from "./file.schema";
import * as fileService from "./file.service";

export const listFiles = createQuery({
  access: "file:read",
  schema: listFilesSchema,
  handler: ({ input }) => fileService.listFiles(input),
});

export const listFileFolders = createQuery({
  access: "file:read",
  schema: noParams,
  handler: () => fileService.listFolders(),
});

export const getFileStats = createQuery({
  access: "file:read",
  schema: noParams,
  handler: () => fileService.getStats(),
});

export const getFile = createQuery({
  access: "file:read",
  schema: getFileSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const f = await fileService.getFile(input.id);
    if (!f) throw new FilingError("FILE_NOT_FOUND", "File not found.");
    return f;
  },
});

export const getFileUsage = createQuery({
  access: "file:read",
  schema: getFileSchema,
  onInvalid: "not-found",
  handler: ({ input }) => fileService.fileUsage(input.id),
});

// The URL to open or download one file (route answers with a 302).
export const openFile = createQuery({
  access: "file:read",
  schema: openFileSchema,
  onInvalid: "not-found",
  handler: ({ input }) => fileService.getAccessUrlById(input.id, { download: !!input.download }),
});
