// AUTH EVENT SCHEMA: the event types and the read filters. CLIENT-SAFE.
// AuthEvent.type is a String in the locked schema; this list is the allowed set
// (Roadmap §4 tech debt: keep it in sync with the Data Model).

import { z } from "zod";
import { dateParam, enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import { id } from "../access.fields";

export const AUTH_EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "INVITE_SENT",
  "INVITE_ACCEPTED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_DONE",
  "PASSWORD_CHANGED",
  "EMAIL_VERIFIED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_DELETED",
  "ROLE_CHANGED",
] as const;
export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

// D-9: these end the user's older sessions (mirrored in validation/auth.ts).
export const PASSWORD_EVENT_TYPES: readonly AuthEventType[] = ["PASSWORD_CHANGED", "PASSWORD_RESET_DONE"];

export const listAuthEventsSchema = listQuery.extend({
  userId: uuidParam,
  type: enumParam(AUTH_EVENT_TYPES),
  from: dateParam,
  to: dateParam,
});
export const getAuthEventSchema = z.object({ id });
export const userActivitySchema = z.object({ userId: id });

export type ListAuthEventsData = z.output<typeof listAuthEventsSchema>;
