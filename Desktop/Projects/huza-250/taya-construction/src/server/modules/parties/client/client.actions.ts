"use server";
// CLIENT ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { PARTIES_PATHS } from "../parties.config";
import { clientIdSchema, createClientSchema, updateClientSchema } from "./client.schema";
import * as clientService from "./client.service";

const refresh = () => {
  revalidatePath(PARTIES_PATHS.clients, "layout");
};

export const createClient = createAction({
  access: "client:create",
  schema: createClientSchema,
  handler: async ({ input }) => {
    const row = await clientService.createClient(input);
    refresh();
    return row;
  },
});

export const updateClient = createAction({
  access: "client:update",
  schema: updateClientSchema,
  handler: async ({ input }) => {
    const row = await clientService.updateClient(input);
    refresh();
    return row;
  },
});

export const deleteClient = createAction({
  access: "client:delete",
  schema: clientIdSchema,
  handler: async ({ input }) => {
    const row = await clientService.deleteClient(input);
    refresh();
    return row;
  },
});
