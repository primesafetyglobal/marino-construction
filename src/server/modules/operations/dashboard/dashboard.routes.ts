// DASHBOARD ROUTES (flow): live counters for the sidebar.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as dashboardQueries from "./dashboard.queries";

export const getOperationsCountersRoute = createRoute({ query: dashboardQueries.getOperationsCounters });
