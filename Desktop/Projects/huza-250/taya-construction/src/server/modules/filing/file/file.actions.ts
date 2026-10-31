"use server";
// FILE ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { createAction } from "@/server/core/action";
import {
  confirmUploadSchema,
  deleteFilesSchema,
  getAccessUrlSchema,
  moveFilesSchema,
  renameFileSchema,
  renameFolderSchema,
  requestUploadSchema,
} from "./file.schema";
import * as fileService from "./file.service";

export const requestFileUpload = createAction({
  access: "file:create",
  schema: requestUploadSchema,
  handler: ({ input }) => fileService.requestUpload(input),
});

export const confirmFileUpload = createAction({
  access: "file:create",
  schema: confirmUploadSchema,
  handler: async ({ input }) => {
    const f = await fileService.confirmUpload(input);
    fileService.invalidateStats();
    return f;
  },
});

export const moveFiles = createAction({
  access: "file:update",
  schema: moveFilesSchema,
  handler: ({ input }) => fileService.moveFiles(input.ids, input.folder),
});

export const renameFile = createAction({
  access: "file:update",
  schema: renameFileSchema,
  handler: ({ input }) => fileService.renameFile(input.id, input.name),
});

export const renameFolder = createAction({
  access: "file:update",
  schema: renameFolderSchema,
  handler: ({ input }) => fileService.renameFolder(input.from!, input.to!),
});

export const deleteFiles = createAction({
  access: "file:delete",
  schema: deleteFilesSchema,
  handler: async ({ input }) => {
    const res = await fileService.deleteFiles(input.ids);
    fileService.invalidateStats();
    return res;
  },
});

// Copy temporary link / open in the preview drawer.
export const getFileAccessUrl = createAction({
  access: "file:read",
  schema: getAccessUrlSchema,
  handler: ({ input }) => fileService.getAccessUrlById(input.id, { download: input.download }),
});
