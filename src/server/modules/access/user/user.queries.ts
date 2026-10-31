// USER QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getUserSchema, listUsersSchema, noInput } from "./user.schema";
import * as userService from "./user.service";

// The handler picker (?picker=1) for anyone who handles requests; the full
// list needs user:read (checked in the service). ACC-R1 scope applies.
export const listUsers = createQuery({
  access: ["user:read", "equipment-request:update", "supply-order:update", "service-request:update", "workforce-request:update"],
  schema: listUsersSchema,
  handler: ({ input, user }) => userService.listUsers(input, { actor: user }),
});

// ACC-R1: a hidden Super Admin answers NOT_FOUND.
export const getUser = createQuery({
  access: "user:read",
  schema: getUserSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await userService.getUserDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("User");
    return row;
  },
});

// My account.
export const getCurrentUser = createQuery({
  access: "authenticated",
  schema: noInput,
  handler: async ({ user }) => {
    const row = await userService.getCurrentUser({ actor: user });
    if (!row) throw Errors.unauthenticated();
    return row;
  },
});
