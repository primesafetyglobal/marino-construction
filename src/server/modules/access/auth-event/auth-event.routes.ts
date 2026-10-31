// AUTH EVENT ROUTES: GET handlers for client components (user activity, filters).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as authEventQueries from "./auth-event.queries";

export const listAuthEventsRoute = createRoute({ query: authEventQueries.listAuthEvents });
export const getAuthEventRoute = createRoute<{ id: string }>({ query: authEventQueries.getAuthEvent });
