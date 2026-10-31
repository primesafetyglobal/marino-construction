// CLIENT ROUTES: GET handlers for client components (list paging, autocomplete).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as clientQueries from "./client.queries";

export const listClientsRoute = createRoute({ query: clientQueries.listClients });
export const getClientRoute = createRoute<{ id: string }>({ query: clientQueries.getClient });
