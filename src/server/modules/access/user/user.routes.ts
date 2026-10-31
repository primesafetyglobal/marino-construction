// USER ROUTES: GET handlers for client components (list paging, handler picker).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as userQueries from "./user.queries";

export const listUsersRoute = createRoute({ query: userQueries.listUsers });
export const getUserRoute = createRoute<{ id: string }>({ query: userQueries.getUser });
