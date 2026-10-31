// CATEGORY ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as categoryQueries from "./category.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listCategoriesRoute = createRoute({ query: categoryQueries.listCategories, cacheControl: PUBLIC_CACHE });
export const getCategoryRoute = createRoute<{ id: string }>({ query: categoryQueries.getCategory, cacheControl: PUBLIC_CACHE });
