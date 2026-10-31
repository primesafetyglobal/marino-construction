// SERVICE REQUEST ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as serviceRequestQueries from "./service-request.queries";

export const listServiceRequestsRoute = createRoute({ query: serviceRequestQueries.listServiceRequests });
export const getServiceRequestRoute = createRoute<{ id: string }>({ query: serviceRequestQueries.getServiceRequest });
