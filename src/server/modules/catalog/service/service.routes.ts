// SERVICE ROUTES: GET handlers for client components (lists, staff pickers).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as serviceQueries from "./service.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listServicesRoute = createRoute({ query: serviceQueries.listServices, cacheControl: PUBLIC_CACHE });
export const getServiceRoute = createRoute<{ id: string }>({ query: serviceQueries.getService, cacheControl: PUBLIC_CACHE });
