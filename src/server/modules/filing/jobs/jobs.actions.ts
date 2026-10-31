"use server";
// JOBS ACTIONS: start import, checks, fixes, base-URL change and migration.
// Each returns at once with the job id; the work continues in the background.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { createAction } from "@/server/core/action";
import {
  applyFixesSchema,
  applyStorageFixesSchema,
  changeBaseUrlSchema,
  deleteAbandonedSchema,
  markFalsePositivesSchema,
  markMissingSchema,
  migrationSourceSchema,
  purgeStorageSchema,
  runCheckSchema,
  runImportSchema,
  startMigrationSchema,
} from "./jobs.schema";
import { noParams } from "@/server/validation/pagination";
import * as jobsService from "./jobs.service";

const idOnly = <T extends { jobId: string; type: string }>(j: T) => ({ jobId: j.jobId, type: j.type });

export const runImportJob = createAction({
  access: "file:create",
  schema: runImportSchema,
  handler: async ({ input }) => idOnly(await jobsService.startImport(input)),
});

export const runCheckJob = createAction({
  access: "file:update",
  schema: runCheckSchema,
  handler: async ({ input }) => idOnly(await jobsService.startCheck(input)),
});

export const applyReferenceFixes = createAction({
  access: "file:update",
  schema: applyFixesSchema,
  handler: async ({ input }) => idOnly(await jobsService.startReferenceFixes(input)),
});

export const applyStorageFixes = createAction({
  access: "file:update",
  schema: applyStorageFixesSchema,
  handler: async ({ input }) => idOnly(await jobsService.startStorageFixes(input)),
});

export const deleteAbandonedUploads = createAction({
  access: "file:delete",
  schema: deleteAbandonedSchema,
  handler: ({ input }) => jobsService.deleteAbandoned(input),
});

export const markDiscoveryFalsePositives = createAction({
  access: "file:update",
  schema: markFalsePositivesSchema,
  handler: ({ input }) => jobsService.markDiscoveryFalsePositives(input),
});

export const changeStorageBaseUrl = createAction({
  access: "file-storage:update",
  schema: changeBaseUrlSchema,
  handler: async ({ input }) => idOnly(await jobsService.startBaseUrlChange(input)),
});

export const startMigration = createAction({
  access: "file-storage:update",
  schema: startMigrationSchema,
  handler: async ({ input }) => idOnly(await jobsService.startMigration(input)),
});

export const resumeMigration = createAction({
  access: "file-storage:update",
  schema: migrationSourceSchema,
  handler: async ({ input }) => idOnly(await jobsService.resumeMigration(input)),
});

export const cancelMigration = createAction({
  access: "file-storage:update",
  schema: noParams,
  handler: async () => jobsService.cancelMigration(),
});

export const finishMigration = createAction({
  access: "file-storage:update",
  schema: migrationSourceSchema,
  handler: async ({ input }) => idOnly(await jobsService.finishMigration(input)),
});

export const markMigrationMissing = createAction({
  access: "file-storage:update",
  schema: markMissingSchema,
  handler: ({ input }) => jobsService.markMigrationMissing(input),
});

export const purgeStorage = createAction({
  access: "file-storage:delete",
  schema: purgeStorageSchema,
  handler: async ({ input }) => idOnly(await jobsService.startPurge(input)),
});
