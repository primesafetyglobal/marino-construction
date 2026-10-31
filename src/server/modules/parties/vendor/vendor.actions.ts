"use server";
// VENDOR ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { createUploadTicket } from "../parties.files";
import { PARTIES_PATHS } from "../parties.config";
import {
  createVendorSchema,
  partiesUploadTicketSchema,
  setVendorPartnerSchema,
  setVendorStatusSchema,
  submitVendorSchema,
  updateVendorSchema,
  vendorIdSchema,
} from "./vendor.schema";
import * as vendorService from "./vendor.service";

const refresh = () => {
  revalidatePath(PARTIES_PATHS.vendors, "layout");
  revalidatePath(PARTIES_PATHS.home);
};

export const createVendor = createAction({
  access: "vendor:create",
  schema: createVendorSchema,
  handler: async ({ input }) => {
    const row = await vendorService.createVendor(input);
    refresh();
    return row;
  },
});

export const updateVendor = createAction({
  access: "vendor:update",
  schema: updateVendorSchema,
  handler: async ({ input }) => {
    const row = await vendorService.updateVendor(input);
    refresh();
    return row;
  },
});

export const setVendorStatus = createAction({
  access: "vendor:update",
  schema: setVendorStatusSchema,
  handler: async ({ input }) => {
    const row = await vendorService.setVendorStatus(input);
    refresh();
    return row;
  },
});

export const setVendorPartner = createAction({
  access: "vendor:partner",
  schema: setVendorPartnerSchema,
  handler: async ({ input }) => {
    const row = await vendorService.setVendorPartner(input);
    refresh();
    return row;
  },
});

export const deleteVendor = createAction({
  access: "vendor:delete",
  schema: vendorIdSchema,
  handler: async ({ input }) => {
    const row = await vendorService.deleteVendor(input);
    refresh();
    return row;
  },
});

// PUBLIC: the "Partner with us" form.
// Protection: strict schema with `consent: true`; honeypot `fax` (fake
// success, nothing saved); Turnstile; 5 per minute per hashed IP; saved
// PENDING; stored vendors are never changed; reply { received: true } only.
export const submitVendor = createAction({
  access: "public",
  schema: submitVendorSchema,
  handler: async ({ input }) => vendorService.submitVendor(input, await getRequestMeta()),
});

// Staff uploads: vendor logos and applicant CVs.
export const createPartiesUploadTicket = createAction({
  access: ["vendor:update", "vendor:create", "applicant:update"],
  schema: partiesUploadTicketSchema,
  handler: async ({ input }) => createUploadTicket(input),
});
