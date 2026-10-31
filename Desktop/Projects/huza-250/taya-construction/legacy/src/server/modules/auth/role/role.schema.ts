// ROLE SCHEMA: what input is allowed.
// CLIENT-SAFE: the form imports this file too. No server imports here.
//
// This file only answers "is this input well formed?".
// It does NOT answer "is it allowed?" (actions/queries) or
// "does it fit the data?" (service: unique name, system roles).
//
// Rules for every schema file:
// 1. Mutation schemas use z.strictObject: unknown fields are rejected.
// 2. Only fields a user may set. isSystem, createdAt, updatedAt are never
//    here, so they can never be sent from the browser.
// 3. No database checks. Schemas must stay sync and client-safe.
// 4. Export each schema plus types: *Input for forms, *Data for the service.

import { z } from "zod";
import { listQuery } from "@/server/validation/pagination";

// ---------- Field rules ----------

const id = z.uuid("Invalid id.");

// Trimmed first, so "   " does not count as a name.
const name = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters.")
  .max(50, "Must be at most 50 characters.")
  .regex(/^[\p{L}\p{N} _-]+$/u, "Use letters, numbers, spaces, hyphens or underscores.");

// undefined = leave unchanged, "" or null = clear it (stored as null).
const description = z
  .string()
  .trim()
  .max(200, "Must be at most 200 characters.")
  .nullish()
  .transform((v) => (v === "" ? null : v));

// Duplicates removed. Size limit so nobody can send a giant list.
const permissionIds = z
  .array(id)
  .max(500, "No more than 500 permissions.")
  .transform((ids) => [...new Set(ids)]);

// ---------- Schemas ----------

export const roleIdSchema = z.strictObject({ id });

export const createRoleSchema = z.strictObject({
  name,
  description,
  permissionIds: permissionIds.default([]),
});

// Partial update: send only what changed.
export const updateRoleSchema = z
  .strictObject({
    id,
    name: name.optional(),
    description,
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: "Nothing to update.",
  });

// Replaces the full permission list of a role in one step.
export const setRolePermissionsSchema = z.strictObject({
  id,
  permissionIds,
});

export const listRolesSchema = listQuery;

// ---------- Types ----------

export type CreateRoleInput = z.input<typeof createRoleSchema>;
export type CreateRoleData = z.output<typeof createRoleSchema>;

export type UpdateRoleInput = z.input<typeof updateRoleSchema>;
export type UpdateRoleData = z.output<typeof updateRoleSchema>;

export type SetRolePermissionsInput = z.input<typeof setRolePermissionsSchema>;
export type SetRolePermissionsData = z.output<typeof setRolePermissionsSchema>;

export type RoleIdInput = z.input<typeof roleIdSchema>;
export type RoleIdData = z.output<typeof roleIdSchema>;

export type ListRolesData = z.output<typeof listRolesSchema>;
