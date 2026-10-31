"use server";
// FILE STORAGE ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.
// Base-URL change and purge are jobs: see ../jobs/jobs.actions.ts.

import { createAction } from "@/server/core/action";
import { confirmStorageSchema, createStorageSchema, storageIdSchema, updateStorageSchema } from "./file-storage.schema";
import * as storageService from "./file-storage.service";

export const createStorage = createAction({
  access: "file-storage:create",
  schema: createStorageSchema,
  handler: ({ input }) => storageService.createStorage(input),
});

export const updateStorage = createAction({
  access: "file-storage:update",
  schema: updateStorageSchema,
  handler: ({ input }) => storageService.updateStorage(input),
});

export const testStorage = createAction({
  access: "file-storage:update",
  schema: storageIdSchema,
  handler: ({ input }) => storageService.testStorageById(input.id),
});

export const activateStorage = createAction({
  access: "file-storage:update",
  schema: storageIdSchema,
  handler: ({ input }) => storageService.activateStorage(input.id),
});

export const deleteStorage = createAction({
  access: "file-storage:delete",
  schema: confirmStorageSchema,
  handler: ({ input }) => storageService.deleteStorage(input.id, input.confirmName),
});
