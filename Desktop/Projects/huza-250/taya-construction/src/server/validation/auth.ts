// Who is calling, and what may they do.
//
// D-3 (docs/DNSA.md): this project has no Role / Permission tables. Each
// User has a Role enum value, and ROLE_PERMISSIONS below maps each role to a
// STATIC set of permission keys that reproduces the role matrix of
// docs/spec/03-architecture.md §6. Actions and queries still name keys, so a
// later move to the Desc RBAC module replaces this map and nothing else.
//
// Keys: read / create / update / delete for every Prisma model, plus the
// declared keys of each module's <module>.permissions.ts (DECLARED_KEYS is
// checked against those files by tests/access-matrix.test.ts).
//
// The user is loaded from the database on each request (React cache(): once
// per render), so deactivating a user or changing a role takes effect on the
// next request. D-9: a session issued before the user's latest password
// change or reset is treated as signed out.

import "server-only";
import { cache } from "react";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/config/authOptions";
import { Errors } from "../core/errors";
import { db, Prisma } from "./db";

// "resource:action", e.g. "equipment:create".
export type PermissionKey = `${string}:${string}`;

// Who may call an action or query. Required, so nobody can forget it.
// - "equipment:create": signed in, active, and holds that key
// - ["user:read", "equipment-request:update"]: holds ANY of these
// - "authenticated": any signed-in, active user (things about the caller)
// - "public": anyone (docs/modules/*.md lists every public entry point)
export type Access = PermissionKey | readonly PermissionKey[] | "authenticated" | "public";

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: ReadonlySet<string>;
};

export { AUTH_PATHS } from "./auth-paths";

// ---------- D-3: the static role map ----------

export const CRUD_ACTIONS = ["read", "create", "update", "delete"] as const;

// "EquipmentRequest" → "equipment-request"
export const toResource = (model: string) => model.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// Must equal the union of every module's PERMISSIONS (tested).
export const DECLARED_KEYS = [
  "equipment:approve",
  "workforce-request:publish",
  "vendor:partner",
  "payment:record",
  "review:publish",
  "user:invite",
  "auth-event:read",
] as const;

export const ALL_KEYS: readonly string[] = [
  ...new Set([
    ...Object.values(Prisma.ModelName).flatMap((model) => CRUD_ACTIONS.map((a) => `${toResource(model)}:${a}`)),
    ...DECLARED_KEYS,
  ]),
].sort();

// Architecture §6: Staff cannot delete (except DUE payments, which the
// payment service limits), cannot mark partners, and has no access to users.
// Filing (guide §11): Staff may browse, upload and organise files; storages,
// settings and backups stay with the technical admins.
const STAFF_DENIED_RESOURCES = new Set(["user", "auth-token", "auth-event", "file-storage", "file-settings", "file-backup"]);
const STAFF_DENIED_KEYS = new Set(["vendor:partner", "user:invite"]);

function staffAllowed(key: string): boolean {
  const [resource, action] = key.split(":");
  if (STAFF_DENIED_RESOURCES.has(resource)) return false;
  if (STAFF_DENIED_KEYS.has(key)) return false;
  if (action === "delete" && key !== "payment:delete") return false;
  return true;
}

// Super Admin and Admin hold the same keys; the difference (Admins never see
// Super Admins) is row-level scope in the access module (D-4).
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
  SUPER_ADMIN: new Set(ALL_KEYS),
  ADMIN: new Set(ALL_KEYS),
  STAFF: new Set(ALL_KEYS.filter(staffAllowed)),
};

// ---------- Session ----------

// The raw NextAuth session, once per request. Prefer getUser().
// Never pass the session object to a client component.
export const getSession = cache((): Promise<Session | null> => getServerSession(authOptions));

// D-9: the AuthEvent types that end older sessions. Mirrors
// modules/access/auth-event/auth-event.schema.ts (the foundation may not import a module).
const PASSWORD_EVENTS = ["PASSWORD_CHANGED", "PASSWORD_RESET_DONE"];

// The caller with live role and permissions, looked up by id (primary key).
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  const userId = session?.user?.id;
  const loginAt = session?.loginAt;
  if (!userId || typeof loginAt !== "number") return null;

  const [user, newerPasswordChange] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
    db.authEvent.findFirst({
      where: { userId, type: { in: PASSWORD_EVENTS }, createdAt: { gt: new Date(loginAt) } },
      select: { id: true },
    }),
  ]);

  // Deleted or deactivated users, and sessions older than the latest
  // password change, are treated as signed out.
  if (!user || !user.isActive || newerPasswordChange) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role],
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

export function hasPermission(user: Pick<SessionUser, "permissions"> | null | undefined, key: PermissionKey): boolean {
  return !!user && user.permissions.has(key);
}

export function hasAnyPermission(user: SessionUser, keys: readonly PermissionKey[]): boolean {
  return keys.some((key) => user.permissions.has(key));
}

export function requirePermission(user: SessionUser, key: PermissionKey): void {
  if (!hasPermission(user, key)) throw Errors.forbidden();
}

// Used by createAction and createQuery. Returns null only for "public".
export async function authorize(access: Access): Promise<SessionUser | null> {
  if (access === "public") return getUser();
  const user = await requireUser();
  if (access === "authenticated") return user;
  const keys: readonly PermissionKey[] = typeof access === "string" ? [access] : access;
  if (!hasAnyPermission(user, keys)) throw Errors.forbidden();
  return user;
}
