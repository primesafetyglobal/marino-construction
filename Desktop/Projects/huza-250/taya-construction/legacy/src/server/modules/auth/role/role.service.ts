// business rules about the model
// ROLE SERVICE: business rules and database work for roles.
//
// This file does NOT check who is calling. Permission checks happen in
// role.actions.ts and role.queries.ts, before the service is reached.
// That keeps the service reusable from scripts, jobs and webhooks.
//
// This file does NOT validate input shape. It receives *Data types that
// already passed the Zod schema.
//
// Role rules:
// - Names are unique (database constraint, turned into a field error by
//   prisma-errors.ts).
// - System roles cannot be edited, deleted, or have permissions changed
//   from the app. Only seed scripts manage them.
// - A role still assigned to users cannot be deleted. Remove it from users
//   first, so nobody loses access by surprise.
// - Permission ids must exist.
//
// Every read uses a select from role.select.ts. Never return a full record.

import "server-only";
import { db, type Prisma } from "@/server/validation/db";
import { AppError, Errors } from "@/server/core/errors";
import { pageArgs, toPage, type Page } from "@/server/validation/pagination";
import {
  roleDetailSelect,
  roleListSelect,
  roleRefSelect,
  type RoleDetail,
  type RoleListItem,
  type RoleRef,
} from "./role.select";
import type {
  CreateRoleData,
  ListRolesData,
  RoleIdData,
  SetRolePermissionsData,
  UpdateRoleData,
} from "./role.schema";

// ======================= Reads =======================

export async function listRoles(query: ListRolesData): Promise<Page<RoleListItem>> {
  const rows = await db.role.findMany({
    // ADJUST: mode "insensitive" works on PostgreSQL. Remove it on MySQL.
    where: query.search
      ? { name: { contains: query.search, mode: "insensitive" } }
      : undefined,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: roleListSelect,
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

// Returns null when missing. The page decides what "not found" looks like.
export function getRoleById(id: string): Promise<RoleDetail | null> {
  return db.role.findUnique({ where: { id }, select: roleDetailSelect });
}

// ======================= Writes =======================

export async function createRole(data: CreateRoleData): Promise<RoleRef> {
  await assertPermissionsExist(data.permissionIds);

  // One create with nested writes: the role and its permissions are saved
  // together or not at all.
  return db.role.create({
    data: {
      name: data.name,
      description: data.description,
      rolePermissions: data.permissionIds.length
        ? { createMany: { data: data.permissionIds.map((permissionId) => ({ permissionId })) } }
        : undefined,
    },
    select: roleRefSelect,
  });
}

export async function updateRole(data: UpdateRoleData): Promise<RoleRef> {
  await getEditableRole(data.id);

  // Fields left undefined are not touched by Prisma.
  return db.role.update({
    where: { id: data.id },
    data: { name: data.name, description: data.description },
    select: roleRefSelect,
  });
}

export async function setRolePermissions(data: SetRolePermissionsData): Promise<RoleRef> {
  await assertPermissionsExist(data.permissionIds);

  // Remove all, then add the new list, in one transaction. Users feel the
  // change on their next request, since auth.ts reads permissions live.
  return db.$transaction(async (tx) => {
    await getEditableRole(data.id, tx);

    await tx.rolePermission.deleteMany({ where: { roleId: data.id } });
    if (data.permissionIds.length) {
      await tx.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({ roleId: data.id, permissionId })),
      });
    }

    // Touch updatedAt so the role shows as changed.
    return tx.role.update({
      where: { id: data.id },
      data: { updatedAt: new Date() },
      select: roleRefSelect,
    });
  });
}

export async function deleteRole({ id }: RoleIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id },
      select: { isSystem: true, _count: { select: { userRoles: true } } },
    });

    if (!role) throw Errors.notFound("Role");
    if (role.isSystem) throw systemRoleError();

    const users = role._count.userRoles;
    if (users > 0) {
      throw Errors.conflict(
        `This role is assigned to ${users} user${users === 1 ? "" : "s"}. Remove it from them first.`,
      );
    }

    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
    return { id };
  });
}

// ======================= Helpers (not exported) =======================

// Loads a role and stops if it is missing or a system role.
// Pass `tx` when called inside a transaction.
async function getEditableRole(id: string, client: Prisma.TransactionClient = db) {
  const role = await client.role.findUnique({
    where: { id },
    select: { id: true, isSystem: true },
  });
  if (!role) throw Errors.notFound("Role");
  if (role.isSystem) throw systemRoleError();
  return role;
}

// Ids are already de-duplicated by the schema, so a simple count works.
async function assertPermissionsExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = await db.permission.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    const message = "Some selected permissions no longer exist.";
    throw new AppError("VALIDATION", message, { fieldErrors: { permissionIds: [message] } });
  }
}

function systemRoleError() {
  return new AppError("FORBIDDEN", "System roles cannot be changed.");
}
