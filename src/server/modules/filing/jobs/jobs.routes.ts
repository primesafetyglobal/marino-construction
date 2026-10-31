// JOBS ROUTES: GET handlers for client components (polled while a job runs).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as jobsQueries from "./jobs.queries";

export const getCurrentJobRoute = createRoute({ query: jobsQueries.getCurrentJob });
export const listJobReportsRoute = createRoute({ query: jobsQueries.listJobReports });
export const getJobReportRoute = createRoute<{ name: string }>({ query: jobsQueries.getJobReport });
export const getMigrationStateRoute = createRoute({ query: jobsQueries.getMigrationState });
export const getMigrationPrecheckRoute = createRoute({ query: jobsQueries.getMigrationPrecheck });
