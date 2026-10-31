// allowed fields for fetching
// ROLE SELECT: which fields are allowed to leave the server.
//
// This file only defines data shapes. No queries, no logic.
//
// Why: Prisma returns every column by default. A select sends exactly what
// the screen needs, and a sensitive column added later can never leak.
//
// Rules for every select file:
// 1. One select per use: list rows, detail page, mutation result.
// 2. _count instead of loading related records you only count.
// 3. Types come from the selects, so the UI always matches the data.
// 4. Type-only Prisma import, so client components may import the types.

import { Prisma } from "@/server/validation/db";



// Rows on the roles list page.
export const roleListSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  updatedAt: true,
  _count: { select: { userRoles: true, rolePermissions: true } },
} satisfies Prisma.RoleSelect;

// Single role page, with its permissions.
export const roleDetailSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  rolePermissions: {
    select: { permission: { select: { id: true, key: true } } },
    orderBy: { permission: { key: "asc" } },
  },
} satisfies Prisma.RoleSelect;

// What create, update and set-permissions return. Small on purpose:
// the page refreshes its own data, the action only confirms the change.
export const roleRefSelect = {
  id: true,
  name: true,
} satisfies Prisma.RoleSelect;

export type RoleListItem = Prisma.RoleGetPayload<{ select: typeof roleListSelect }>;
export type RoleDetail = Prisma.RoleGetPayload<{ select: typeof roleDetailSelect }>;
export type RoleRef = Prisma.RoleGetPayload<{ select: typeof roleRefSelect }>;
