// createAction: the only way to build a server action.
// Steps: identify caller → check access → validate → handler → ActionResult.

import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { authorize, type Access, type SessionUser } from "../validation/auth";
import { toSafeError } from "../validation/prisma-errors";
import { Errors } from "./errors";
import { toActionError, type ActionResult } from "./result";

type Handler<S extends z.ZodType, U, T> = (args: { input: z.output<S>; user: U }) => Promise<T>;

export type Action<S extends z.ZodType, T> = (input: z.input<S>) => Promise<ActionResult<T>>;

// Public actions may have no user, so the handler must handle null.
export function createAction<S extends z.ZodType, T>(config: {
  access: "public";
  schema: S;
  handler: Handler<S, SessionUser | null, T>;
}): Action<S, T>;

// Protected actions always get a real user.
export function createAction<S extends z.ZodType, T>(config: {
  access: Exclude<Access, "public">;
  schema: S;
  handler: Handler<S, SessionUser, T>;
}): Action<S, T>;

export function createAction(config: {
  access: Access;
  schema: z.ZodType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: { input: any; user: any }) => Promise<unknown>;
}) {
  return async (raw: unknown): Promise<ActionResult<unknown>> => {
    try {
      const user = await authorize(config.access);
      // The client can send anything. Never trust `raw`, only `parsed.data`.
      const parsed = await config.schema.safeParseAsync(raw);
      if (!parsed.success) {
        return { ok: false, error: toActionError(Errors.validation(parsed.error)) };
      }
      const data = await config.handler({ input: parsed.data, user });
      return { ok: true, data };
    } catch (err) {
      // redirect() and notFound() work by throwing. Let them through.
      unstable_rethrow(err);
      return { ok: false, error: toActionError(toSafeError(err)) };
    }
  };
}
