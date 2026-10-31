// JOB APPLICATION ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as jobApplicationQueries from "./job-application.queries";

export const listApplicationsRoute = createRoute({ query: jobApplicationQueries.listApplications });
export const getApplicationRoute = createRoute<{ id: string }>({ query: jobApplicationQueries.getApplication });
