"use server";
// SERVICE ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { CATALOG_PATHS } from "../catalog.config";
import { createServiceSchema, serviceIdSchema, updateServiceSchema } from "./service.schema";
import * as serviceService from "./service.service";

const refresh = () => {
  revalidatePath(CATALOG_PATHS.public, "layout");
};

export const createService = createAction({
  access: "service:create",
  schema: createServiceSchema,
  handler: async ({ input }) => {
    const row = await serviceService.createService(input);
    refresh();
    return row;
  },
});

export const updateService = createAction({
  access: "service:update",
  schema: updateServiceSchema,
  handler: async ({ input }) => {
    const row = await serviceService.updateService(input);
    refresh();
    return row;
  },
});

export const deleteService = createAction({
  access: "service:delete",
  schema: serviceIdSchema,
  handler: async ({ input }) => {
    const row = await serviceService.deleteService(input);
    refresh();
    return row;
  },
});
