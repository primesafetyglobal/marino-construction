// WORKFORCE REQUEST ROUTES: staff GET handlers, plus the public job posts.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as workforceRequestQueries from "./workforce-request.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listWorkforceRequestsRoute = createRoute({ query: workforceRequestQueries.listWorkforceRequests });
export const getWorkforceRequestRoute = createRoute<{ id: string }>({ query: workforceRequestQueries.getWorkforceRequest });
export const listJobsRoute = createRoute({ query: workforceRequestQueries.getOpenJobs, cacheControl: PUBLIC_CACHE });
export const getJobRoute = createRoute<{ number: string }>({ query: workforceRequestQueries.getJobByNumber, cacheControl: PUBLIC_CACHE });
