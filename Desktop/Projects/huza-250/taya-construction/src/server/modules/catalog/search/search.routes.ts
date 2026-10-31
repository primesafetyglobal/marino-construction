// SEARCH ROUTES (flow).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as searchQueries from "./search.queries";

export const searchCatalogRoute = createRoute({
  query: searchQueries.searchCatalog,
  cacheControl: "public, s-maxage=300, stale-while-revalidate=60",
});
