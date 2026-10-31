// createRoute: the only way to build a GET route handler.
//
// A route is a thin HTTP adapter over a query: URL → object → query →
// JSON ActionResult with the right status code. All rules live in the query.
// Routes are GET only. Writes go through server actions.
//
// Project addition (docs/DNSA.md, D-16): a route with a public cacheControl
// still answers "private, no-store" when the request carries a session
// cookie, because the same URL may return the staff select to signed-in staff.

import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { toSafeError } from "../validation/prisma-errors";
import type { ErrorCode } from "./errors";
import { toActionError, type ActionResult } from "./result";

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

// Data behind a login must never sit in a shared cache.
const DEFAULT_CACHE = "private, no-store";

export type SearchParamsObject = Record<string, string | string[]>;

// Repeated keys (?tag=a&tag=b) become arrays.
export function searchParamsToObject(params: URLSearchParams): SearchParamsObject {
  const out: SearchParamsObject = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => c.name.includes("next-auth.session-token"));
}

export function createRoute<P extends Record<string, string> = Record<string, never>>(config: {
  query: (input: never) => Promise<unknown>;
  // Default: search params merged with path params (path params win).
  input?: (args: { searchParams: SearchParamsObject; params: P }) => unknown;
  // Only for public, non-personal data. Default "private, no-store".
  cacheControl?: string;
}) {
  return async function GET(req: NextRequest, ctx: { params: Promise<P> }) {
    try {
      const params = ((await ctx?.params) ?? {}) as P;
      const searchParams = searchParamsToObject(req.nextUrl.searchParams);
      const raw = config.input ? config.input({ searchParams, params }) : { ...searchParams, ...params };
      const data = await config.query(raw as never);
      const cache = config.cacheControl && !hasSessionCookie(req) ? config.cacheControl : DEFAULT_CACHE;
      return respond({ ok: true, data }, 200, cache);
    } catch (err) {
      unstable_rethrow(err);
      const error = toSafeError(err);
      return respond({ ok: false, error: toActionError(error) }, HTTP_STATUS[error.code], DEFAULT_CACHE);
    }
  };
}

function respond(body: ActionResult<unknown>, status: number, cacheControl: string) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": cacheControl, Vary: "Cookie" } });
}
