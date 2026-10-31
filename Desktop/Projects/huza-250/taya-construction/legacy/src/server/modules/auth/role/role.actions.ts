// boundary between the server and the browser
"use server";

// ROLE ACTIONS: the public mutations the browser may call.
//
// WARNING: every export in this file becomes a public endpoint.
// Export only actions built with createAction. No helpers, no reads.
//
// Each action is thin:
//   createAction checks access and validates input,
//   the service does the work,
//   the action refreshes the affected pages.
//
// Permission keys follow the RBAC module: role:create, role:update,
// role:delete. Changing permissions of a role counts as role:update.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import {
  createRoleSchema,
  roleIdSchema,
  setRolePermissionsSchema,
  updateRoleSchema,
} from "./role.schema";
import * as roleService from "./role.service";

// ADJUST: where the roles pages live in this app.
// "layout" refreshes the list page and every page under it.
const ROLES_PATH = "/admin/roles";

export const createRole = createAction({
  access: "role:create",
  schema: createRoleSchema,
  handler: async ({ input }) => {
    const role = await roleService.createRole(input);
    revalidatePath(ROLES_PATH, "layout");
    return role;
  },
});

export const updateRole = createAction({
  access: "role:update",
  schema: updateRoleSchema,
  handler: async ({ input }) => {
    const role = await roleService.updateRole(input);
    revalidatePath(ROLES_PATH, "layout");
    return role;
  },
});

export const setRolePermissions = createAction({
  access: "role:update",
  schema: setRolePermissionsSchema,
  handler: async ({ input }) => {
    const role = await roleService.setRolePermissions(input);
    revalidatePath(ROLES_PATH, "layout");
    return role;
  },
});

export const deleteRole = createAction({
  access: "role:delete",
  schema: roleIdSchema,
  handler: async ({ input }) => {
    const result = await roleService.deleteRole(input);
    revalidatePath(ROLES_PATH, "layout");
    return result;
  },
});
