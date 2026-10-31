// Cursor pagination and URL param helpers, the same in every app.
// CLIENT-SAFE: no server imports.
//
// Cursor, not page numbers: offset gets slower on deep pages and skips or
// repeats rows when records are added while paging.
// No total count by default. Add a count only where a screen truly needs it.
//
// Rule: order lists by a stable key ending with id,
// e.g. orderBy: [{ createdAt: "desc" }, { id: "desc" }].
//
// URL input is lenient: a bad param falls back to its default instead of
// failing, so a hand-edited URL never breaks a page or a route.

import { z } from "zod";

// ---------- URL param helpers (for read schemas only) ----------

export const booleanParam = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .optional()
  .catch(undefined);

export const uuidParam = z.uuid().optional().catch(undefined);

export const dateParam = z.coerce.date().optional().catch(undefined);

export const intParam = z.coerce.number().int().min(0).max(1_000_000_000).optional().catch(undefined);

export const textParam = (max = 100) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .catch(undefined)
    .transform((v) => v || undefined);

export const enumParam = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

// For queries that take no input.
export const noParams = z.object({});

// ---------- List query ----------

// z.object (not strict): reading is harmless and URLs may carry extra params.
export const listQuery = z.object({
  q: textParam(100),
  cursor: uuidParam,
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
});

export type ListQuery = z.output<typeof listQuery>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// Prisma args for one page. Asks for one extra row: if it comes back there
// is a next page, without a count query.
export function pageArgs(query: { cursor?: string; limit: number }) {
  return {
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
