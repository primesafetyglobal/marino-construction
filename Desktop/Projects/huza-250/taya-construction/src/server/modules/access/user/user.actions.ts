"use server";
// USER ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { contextFor, getRequestMeta } from "@/server/validation/request";
import { ACCESS_PATHS } from "../access.config";
import {
  acceptInviteSchema,
  changeOwnPasswordSchema,
  inviteUserSchema,
  requestEmailChangeSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
  userIdSchema,
  verifyEmailSchema,
} from "./user.schema";
import * as userService from "./user.service";

const refresh = () => {
  revalidatePath(ACCESS_PATHS.users, "layout");
};

export const inviteUser = createAction({
  access: "user:invite",
  schema: inviteUserSchema,
  handler: async ({ input, user }) => {
    const row = await userService.inviteUser(input, await contextFor(user));
    refresh();
    return row;
  },
});

export const resendInvite = createAction({
  access: "user:invite",
  schema: userIdSchema,
  handler: async ({ input, user }) => {
    const row = await userService.resendInvite(input, await contextFor(user));
    refresh();
    return row;
  },
});

export const updateUser = createAction({
  access: "user:update",
  schema: updateUserSchema,
  handler: async ({ input, user }) => {
    const row = await userService.updateUser(input, await contextFor(user));
    refresh();
    return row;
  },
});

export const setUserActive = createAction({
  access: "user:update",
  schema: setUserActiveSchema,
  handler: async ({ input, user }) => {
    const row = await userService.setUserActive(input, await contextFor(user));
    refresh();
    return row;
  },
});

export const sendPasswordReset = createAction({
  access: "user:update",
  schema: userIdSchema,
  handler: async ({ input, user }) => userService.sendPasswordReset(input, await contextFor(user)),
});

export const deleteUser = createAction({
  access: "user:delete",
  schema: userIdSchema,
  handler: async ({ input, user }) => {
    const row = await userService.deleteUser(input, await contextFor(user));
    refresh();
    return row;
  },
});

// About the caller only.
export const changeOwnPassword = createAction({
  access: "authenticated",
  schema: changeOwnPasswordSchema,
  handler: async ({ input, user }) => userService.changeOwnPassword(input, await contextFor(user)),
});

// About the caller only.
export const requestEmailChange = createAction({
  access: "authenticated",
  schema: requestEmailChangeSchema,
  handler: async ({ input, user }) => userService.requestEmailChange(input, await contextFor(user)),
});

// PUBLIC: set a password from an invite link.
// Protection: strict schema; a single-use, hashed INVITE token that has not
// expired (7 days); password rules; the reply is the account email only.
export const acceptInvite = createAction({
  access: "public",
  schema: acceptInviteSchema,
  handler: async ({ input }) => userService.acceptInvite(input, await getRequestMeta()),
});

// PUBLIC: "Forgot password".
// Protection: strict schema; the same reply for every email; 3 per email and
// 10 per IP per hour counted from AuthEvent.
export const requestPasswordReset = createAction({
  access: "public",
  schema: requestPasswordResetSchema,
  handler: async ({ input }) => userService.requestPasswordReset(input.email, await getRequestMeta()),
});

// PUBLIC: set a new password from a reset link.
// Protection: strict schema; a single-use, hashed PASSWORD_RESET token that has
// not expired (1 hour); password rules; older sessions end (D-9).
export const resetPassword = createAction({
  access: "public",
  schema: resetPasswordSchema,
  handler: async ({ input }) => userService.resetPassword(input, await getRequestMeta()),
});

// PUBLIC: confirm a new email from its link.
// Protection: strict schema; a single-use, hashed EMAIL_VERIFY token that has
// not expired (24 hours); the address must still be free.
export const verifyEmail = createAction({
  access: "public",
  schema: verifyEmailSchema,
  handler: async ({ input }) => userService.verifyEmail(input.token, await getRequestMeta()),
});
