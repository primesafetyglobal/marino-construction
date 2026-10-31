// createQuery: the only way to build a read.
// Steps: identify caller → check access → validate → handler → data.
//
// A query is a function that returns data or throws AppError. Routes call it
// directly. Server Components call query.page(), which turns errors into
// Next.js navigation: not found page, sign-in redirect, forbidden page.

import "server-only";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { AUTH_PATHS, authorize, type Access, type SessionUser } from "../validation/auth";
import { toSafeError } from "../validation/prisma-errors";
import { Errors } from "./errors";

type Handler<S extends z.ZodType, U, T> = (args: { input: z.output<S>; user: U }) => Promise<T>;

export type Query<S extends z.ZodType, T> = ((input: z.input<S>) => Promise<T>) & {
  /** For Server Components. NOT_FOUND → notFound(), UNAUTHENTICATED → sign in,
   *  FORBIDDEN → forbidden page, anything else → nearest error.tsx. */
  page: (input: z.input<S>) => Promise<T>;
};

type BaseConfig<S extends z.ZodType> = {
  schema: S;
  // "not-found" for lookups by id: a malformed id is just a missing record.
  onInvalid?: "validation" | "not-found";
};

export function createQuery<S extends z.ZodType, T>(
  config: BaseConfig<S> & { access: "public"; handler: Handler<S, SessionUser | null, T> },
): Query<S, T>;
export function createQuery<S extends z.ZodType, T>(
  config: BaseConfig<S> & { access: Exclude<Access, "public">; handler: Handler<S, SessionUser, T> },
): Query<S, T>;
export function createQuery(
  config: BaseConfig<z.ZodType> & {
    access: Access;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: { input: any; user: any }) => Promise<unknown>;
  },
) {
  const run = async (raw: unknown) => {
    const user = await authorize(config.access);
    const parsed = await config.schema.safeParseAsync(raw);
    if (!parsed.success) {
      throw config.onInvalid === "not-found" ? Errors.notFound() : Errors.validation(parsed.error);
    }
    return config.handler({ input: parsed.data, user });
  };

  const page = async (raw: unknown) => {
    try {
      return await run(raw);
    } catch (err) {
      unstable_rethrow(err);
      const error = toSafeError(err);
      if (error.code === "NOT_FOUND") notFound();
      if (error.code === "UNAUTHENTICATED") redirect(AUTH_PATHS.signIn);
      if (error.code === "FORBIDDEN") redirect(AUTH_PATHS.forbidden);
      throw error;
    }
  };

  return Object.assign(run, { page });
}
