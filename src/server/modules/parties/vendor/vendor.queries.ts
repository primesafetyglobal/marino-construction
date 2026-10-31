// VENDOR QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { noParams } from "@/server/validation/pagination";
import { getVendorSchema, listVendorsSchema, partnersSchema } from "./vendor.schema";
import * as vendorService from "./vendor.service";

// Also the vendor picker when linking a vendor to a request.
export const listVendors = createQuery({
  access: "vendor:read",
  schema: listVendorsSchema,
  handler: ({ input }) => vendorService.listVendors(input),
});

export const getVendor = createQuery({
  access: "vendor:read",
  schema: getVendorSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await vendorService.getVendorDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Vendor");
    return row;
  },
});

// PUBLIC: "Our partners" and "Featured shops" (PTY-R7). Public select only.
export const getPartners = createQuery({
  access: "public",
  schema: partnersSchema,
  handler: () => vendorService.listPartners(),
});

// PUBLIC: "Featured shops" on the home page (PTY-R7).
export const getFeaturedShops = createQuery({
  access: "public",
  schema: partnersSchema,
  handler: () => vendorService.listFeaturedShops(),
});

// Dashboard counter: vendors waiting for approval.
export const getPendingVendorCount = createQuery({
  access: "vendor:read",
  schema: noParams,
  handler: () => vendorService.countPendingVendors(),
});
