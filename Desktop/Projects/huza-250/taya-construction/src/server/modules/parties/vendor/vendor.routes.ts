// VENDOR ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as vendorQueries from "./vendor.queries";

export const listVendorsRoute = createRoute({ query: vendorQueries.listVendors });
export const getVendorRoute = createRoute<{ id: string }>({ query: vendorQueries.getVendor });
export const listPartnersRoute = createRoute({
  query: vendorQueries.getPartners,
  cacheControl: "public, s-maxage=300, stale-while-revalidate=60",
});
