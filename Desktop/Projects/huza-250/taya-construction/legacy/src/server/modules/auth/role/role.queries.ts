// this is there for reading data or fetching data
// ROLE QUERIES: reads for Server Components (pages, layouts, metadata).
//
// Every query does three things, in this order:
//   1. check the caller's permission ("role:read")
//   2. validate what came from the URL (params, search params)
//   3. call the service
//
// Reads are NOT server actions. Pages call these functions directly on the
// server. Never import this file in a client component.
//
// Bad URL input never crashes the page: a bad search param falls back to
// defaults, a bad id is treated as "not found".

import "server-only";
import { cache } from "react";
import { requirePermission, requireUser } from "@/server/validation/auth";
import { listRolesSchema, roleIdSchema } from "./role.schema";
import * as roleService from "./role.service";

// For the roles list page. Pass the awaited searchParams object.
export async function getRolesPage(searchParams: unknown) {
  const user = await requireUser();
  requirePermission(user, "role:read");

  const parsed = listRolesSchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : listRolesSchema.parse({});

  return roleService.listRoles(query);
}

// For the role detail page. Returns null when missing, so the page can call
// notFound(). Wrapped in cache() so the page and generateMetadata share
// one database call per request.
export const getRole = cache(async (id: string) => {
  const user = await requireUser();
  requirePermission(user, "role:read");

  const parsed = roleIdSchema.safeParse({ id });
  if (!parsed.success) return null;

  return roleService.getRoleById(parsed.data.id);
});
