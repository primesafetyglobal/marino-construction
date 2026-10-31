// AUTH EVENT QUERIES: read only. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getAuthEventSchema, listAuthEventsSchema, userActivitySchema } from "./auth-event.schema";
import * as authEventService from "./auth-event.service";

export const listAuthEvents = createQuery({
  access: "auth-event:read",
  schema: listAuthEventsSchema,
  handler: ({ input, user }) => authEventService.listAuthEvents(input, { actor: user }),
});

export const getAuthEvent = createQuery({
  access: "auth-event:read",
  schema: getAuthEventSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await authEventService.getAuthEventDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Event");
    return row;
  },
});

export const getUserActivity = createQuery({
  access: "auth-event:read",
  schema: userActivitySchema,
  onInvalid: "not-found",
  handler: ({ input, user }) => authEventService.getUserActivity(input.userId, { actor: user }),
});
