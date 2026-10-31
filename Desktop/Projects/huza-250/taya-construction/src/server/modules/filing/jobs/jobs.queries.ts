// JOBS QUERIES: live progress, reports, migration state. Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { currentJobSchema, getReportSchema, listReportsSchema, migrationPrecheckSchema, migrationStateSchema } from "./jobs.schema";
import * as jobsService from "./jobs.service";

export const getCurrentJob = createQuery({
  access: "file:read",
  schema: currentJobSchema,
  handler: () => jobsService.currentJob(),
});

export const listJobReports = createQuery({
  access: "file:read",
  schema: listReportsSchema,
  handler: ({ input }) => jobsService.reports(input.limit),
});

export const getJobReport = createQuery({
  access: "file:read",
  schema: getReportSchema,
  onInvalid: "not-found",
  handler: ({ input }) => jobsService.report(input.name),
});

export const getMigrationState = createQuery({
  access: "file-storage:read",
  schema: migrationStateSchema,
  handler: () => jobsService.getMigrationState(),
});

// Runs the storage test of the target: an on-demand check, not a page load.
export const getMigrationPrecheck = createQuery({
  access: "file-storage:update",
  schema: migrationPrecheckSchema,
  handler: ({ input }) => jobsService.migrationPrecheck(input),
});
