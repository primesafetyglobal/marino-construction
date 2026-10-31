// DASHBOARD QUERIES (flow). Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { dashboardSchema } from "./dashboard.schema";
import * as dashboardService from "./dashboard.service";

const READ_ANY_REQUEST = ["equipment-request:read", "supply-order:read", "service-request:read", "workforce-request:read"] as const;

export const getOperationsDashboard = createQuery({
  access: READ_ANY_REQUEST,
  schema: dashboardSchema,
  handler: ({ user }) => dashboardService.getDashboard({ actor: user }),
});

// Sidebar counters on every admin page.
export const getOperationsCounters = createQuery({
  access: READ_ANY_REQUEST,
  schema: dashboardSchema,
  handler: () => dashboardService.countOperations(),
});
