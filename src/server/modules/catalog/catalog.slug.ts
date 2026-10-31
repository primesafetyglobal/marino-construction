// CATALOG SLUG: slugs for public URLs (CAT-R1).
// Server-only helper: takes the caller's DbClient so the check joins its transaction.

import "server-only";
import { Errors } from "@/server/core/errors";
import type { DbClient } from "@/server/validation/db";

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "item";
}

type SlugModel = "category" | "equipment" | "product" | "service" | "training";

// CAT-R1: a given slug must be free; a generated one gets -2, -3 … until free.
export async function uniqueSlug(
  model: SlugModel,
  opts: { wanted?: string; from: string; exceptId?: string },
  client: DbClient,
): Promise<string> {
  const taken = async (slug: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (client as any)[model] as { findUnique: (a: unknown) => Promise<{ id: string } | null> };
    const row = await delegate.findUnique({ where: { slug }, select: { id: true } });
    return !!row && row.id !== opts.exceptId;
  };
  if (opts.wanted) {
    if (await taken(opts.wanted)) throw Errors.conflict("This slug is already in use.", { slug: ["Already in use."] });
    return opts.wanted;
  }
  const base = slugify(opts.from);
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
