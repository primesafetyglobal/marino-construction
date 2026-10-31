// PRODUCT ROUTES: GET handlers for client components (lists, "load more", staff pickers).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as productQueries from "./product.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listProductsRoute = createRoute({ query: productQueries.listProducts, cacheControl: PUBLIC_CACHE });
export const getProductRoute = createRoute<{ id: string }>({ query: productQueries.getProduct, cacheControl: PUBLIC_CACHE });
