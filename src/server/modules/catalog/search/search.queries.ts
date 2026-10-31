// SEARCH QUERIES (flow). Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { getRequestMeta } from "@/server/validation/request";
import { searchCatalogSchema } from "./search.schema";
import * as searchService from "./search.service";

// PUBLIC: header live search. Public states and fields only; rate-limited.
export const searchCatalog = createQuery({
  access: "public",
  schema: searchCatalogSchema,
  handler: async ({ input }) => searchService.searchCatalog(input, await getRequestMeta()),
});
