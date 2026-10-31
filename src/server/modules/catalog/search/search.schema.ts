// SEARCH SCHEMA (flow): the live search parameters. CLIENT-SAFE.

import { z } from "zod";

export const searchCatalogSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .catch(undefined)
    .transform((v) => v ?? ""),
  limit: z.coerce.number().int().min(1).max(10).default(5).catch(5),
});

export type SearchCatalogData = z.output<typeof searchCatalogSchema>;
