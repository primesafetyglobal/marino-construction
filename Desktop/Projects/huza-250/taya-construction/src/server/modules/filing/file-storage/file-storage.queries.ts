// FILE STORAGE QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { getStorageSchema, listStoragesSchema } from "./file-storage.schema";
import * as storageService from "./file-storage.service";

// Storages without secrets, with file counts and migration state.
export const listStorages = createQuery({
  access: "file-storage:read",
  schema: listStoragesSchema,
  handler: () => storageService.listStorages(),
});

export const getStorage = createQuery({
  access: "file-storage:read",
  schema: getStorageSchema,
  onInvalid: "not-found",
  handler: ({ input }) => storageService.getStorageDto(input.id),
});
