// CLIENT QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getClientSchema, listClientsSchema } from "./client.schema";
import * as clientService from "./client.service";

// Also the client autocomplete on "New request".
export const listClients = createQuery({
  access: "client:read",
  schema: listClientsSchema,
  handler: ({ input }) => clientService.listClients(input),
});

// With all requests, payments and reviews.
export const getClient = createQuery({
  access: "client:read",
  schema: getClientSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await clientService.getClientDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Client");
    return row;
  },
});
