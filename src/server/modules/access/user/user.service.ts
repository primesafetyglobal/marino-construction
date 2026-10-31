// USER SERVICE: staff logins with a role (Super Admin / Admin / Staff).
//
// This service also writes AuthToken, which has no folder of its own (DNSA ch. 8):
// tokens are only created, used and retired inside user actions, have no
// route and are never listed (docs/modules/access.md).
//
// Rules:
// - ACC-R1  SUPER_ADMIN users are invisible to ADMINs: lists exclude them and
//           any action that targets one answers NOT_FOUND (D-4)
// - ACC-R2  nobody deletes, deactivates or changes the role of themselves
// - ACC-R3  at least one active SUPER_ADMIN remains (advisory lock)
// - ACC-R4  inactive and invite-pending users cannot log in
// - ACC-R5  tokens: 32 random bytes, SHA-256 stored, single use, expiry,
//           a new token retires older ones of the same type
// - ACC-R6  requestPasswordReset answers the same for every email
// - ACC-R7  login / reset rate limits counted from AuthEvent
// - ACC-R8  passwords ≥ 10 characters, bcrypt, never returned
// - ACC-R9  every auth change writes an AuthEvent
// - ACC-R11 a new email is saved only after verification
// - ACC-R12 a user who handles requests cannot be deleted
// - ACC-R16 ADMINs give only ADMIN / STAFF roles
//
// Emails are sent after commit and never fail the change (emailSent flag).

import "server-only";
import bcrypt from "bcryptjs";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import type { RequestMeta, ServiceContext } from "@/server/validation/request";
import { ACCESS_CONFIG } from "../access.config";
import { hashToken, newRawToken } from "../access.tokens";
import { assignableRolesFor } from "../access.fields";
import { sendInviteEmail, sendResetEmail, sendVerifyEmail } from "../access.emails";
import type { Role } from "../access.select";
import { countRecentEvents, recordAuthEvent } from "../auth-event/auth-event.service";
import {
  loginSchema,
  type AcceptInviteData,
  type ChangeOwnPasswordData,
  type InviteUserData,
  type ListUsersData,
  type ResetPasswordData,
  type SetUserActiveData,
  type UpdateUserData,
  type UserIdData,
} from "./user.schema";
import {
  currentUserSelect,
  userAdminSelect,
  userPickerSelect,
  userRefSelect,
  type CurrentUser,
  type UserDetail,
  type UserItem,
  type UserList,
  type UserRef,
} from "./user.select";

type Actor = { actor: SessionUser };
type TokenType = "INVITE" | "PASSWORD_RESET" | "EMAIL_VERIFY";

const NO_PASSWORD = ""; // D-14: the locked schema's password is required; "" = invite pending
const DUMMY_HASH = "$2b$12$vjg9CijrRT6uIyeTZsyiY.lUhVld2FUy7YFmGw8v.2b0VixY8JKci"; // bcrypt of a random string, for equal timing

// ======================= Scope (ACC-R1) =======================

export function userScope(actor: SessionUser): Prisma.UserWhereInput {
  return actor.role === "SUPER_ADMIN" ? {} : { role: { not: "SUPER_ADMIN" } };
}

async function findTarget(id: string, actor: SessionUser, client: DbClient) {
  const row = await client.user.findFirst({ where: { id, ...userScope(actor) }, select: { id: true, name: true, email: true, role: true, isActive: true, password: true } });
  if (!row) throw Errors.notFound("User");
  return row;
}

const toItem = ({ password, ...rest }: Prisma.UserGetPayload<{ select: typeof userAdminSelect }>): UserItem => ({
  ...rest,
  invitePending: password === NO_PASSWORD,
});

// Roles this actor may give (ACC-R16).
const assignableRoles = (actor: SessionUser): Role[] => assignableRolesFor(actor.role);

// ======================= Reads =======================

// The handler picker (any staff who handles requests) or the users list (user:read).
export async function listUsers(query: ListUsersData, ctx: Actor): Promise<UserList> {
  if (query.picker) {
    const rows = await db.user.findMany({
      where: { isActive: true, password: { not: NO_PASSWORD }, ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: userPickerSelect,
      ...pageArgs(query),
    });
    return { view: "picker", ...toPage(rows, query.limit) };
  }
  if (!hasPermission(ctx.actor, "user:read")) throw Errors.forbidden();
  const and: Prisma.UserWhereInput[] = [userScope(ctx.actor)];
  if (query.role) and.push({ role: query.role });
  if (query.active !== undefined) and.push({ isActive: query.active });
  if (query.q) and.push({ OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q.toLowerCase() } }] });
  const rows = await db.user.findMany({ where: { AND: and }, orderBy: [{ name: "asc" }, { id: "asc" }], select: userAdminSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  return { view: "admin", items: page.items.map(toItem), nextCursor: page.nextCursor };
}

// ACC-R1: a SUPER_ADMIN is "not found" for an ADMIN.
export async function getUserDetail(id: string, ctx: Actor): Promise<UserDetail | null> {
  const row = await db.user.findFirst({ where: { id, ...userScope(ctx.actor) }, select: userAdminSelect });
  if (!row) return null;
  const item = toItem(row);
  const self = row.id === ctx.actor.id;
  return {
    ...item,
    can: {
      edit: hasPermission(ctx.actor, "user:update"),
      deactivate: hasPermission(ctx.actor, "user:update") && !self,
      delete: hasPermission(ctx.actor, "user:delete") && !self,
      resendInvite: hasPermission(ctx.actor, "user:invite") && item.invitePending,
      sendReset: hasPermission(ctx.actor, "user:update") && !item.invitePending,
      roles: self ? [] : assignableRoles(ctx.actor),
    },
  };
}

export function getCurrentUser(ctx: Actor): Promise<CurrentUser | null> {
  return db.user.findUnique({ where: { id: ctx.actor.id }, select: currentUserSelect });
}

// ======================= Login (NextAuth) =======================

export type LoginResult = { ok: true; user: { id: string; email: string; name: string } } | { ok: false; reason: "INVALID" | "RATE_LIMITED" };

// ACC-R4, R7, R9. Called by config/authOptions.ts.
export async function verifyLogin(raw: unknown, meta: RequestMeta): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const { email, password } = parsed.data;
  const limits = ACCESS_CONFIG.limits;

  const [byEmail, byIp] = await Promise.all([
    countRecentEvents({ type: "LOGIN_FAILED", windowMs: limits.loginPerEmail.windowMs, email }, db),
    countRecentEvents({ type: "LOGIN_FAILED", windowMs: limits.loginPerIp.windowMs, ip: meta.ip }, db),
  ]);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, password: true, isActive: true } });
  const event = { ip: meta.ip, userAgent: meta.userAgent };

  if (byEmail >= limits.loginPerEmail.max || byIp >= limits.loginPerIp.max) {
    await recordAuthEvent({ type: "LOGIN_FAILED", userId: user?.id, ...event, metadata: { email, reason: "rate_limited" } }, db);
    return { ok: false, reason: "RATE_LIMITED" };
  }

  // Same work whether or not the user exists, so timing reveals nothing.
  const hash = user?.password || DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);
  const reason = !user ? "unknown_email" : !user.isActive ? "inactive" : user.password === NO_PASSWORD ? "invite_pending" : !matches ? "wrong_password" : null;
  if (reason || !user) {
    await recordAuthEvent({ type: "LOGIN_FAILED", userId: user?.id, ...event, metadata: { email, reason } }, db);
    return { ok: false, reason: "INVALID" };
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAuthEvent({ type: "LOGIN_SUCCESS", userId: user.id, ...event, metadata: { email } }, tx);
  });
  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}

export async function recordLogout(userId: string): Promise<void> {
  await recordAuthEvent({ type: "LOGOUT", userId }, db).catch((err) => console.error("[access] logout event failed", err));
}

// ======================= Writes (admin) =======================

// ACC-R1, R5, R9, R16.
export async function inviteUser(data: InviteUserData, ctx: ServiceContext): Promise<UserRef & { emailSent: boolean }> {
  assertCanAssign(ctx.actor, data.role);
  const { user, raw } = await db.$transaction(async (tx) => {
    const taken = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (taken) throw Errors.conflict("A user with this email already exists.", { email: ["Already in use."] });
    const user = await tx.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, role: data.role, password: NO_PASSWORD, mustChangePassword: true, isActive: true },
      select: userRefSelect,
    });
    const raw = await issueToken(user.id, "INVITE", tx);
    await recordAuthEvent({ type: "INVITE_SENT", userId: user.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, role: data.role } }, tx);
    return { user, raw };
  });
  const emailSent = await sendInviteEmail(user.email, user.name, raw).then(
    () => true,
    (err) => (console.error("[access] invite email failed", err), false),
  );
  return { ...user, emailSent };
}

// ACC-R1, R5.
export async function resendInvite({ id }: UserIdData, ctx: ServiceContext): Promise<UserRef & { emailSent: boolean }> {
  const { user, raw } = await db.$transaction(async (tx) => {
    const target = await findTarget(id, ctx.actor, tx);
    if (target.password !== NO_PASSWORD) throw Errors.conflict("This user has already accepted the invite.");
    const raw = await issueToken(target.id, "INVITE", tx);
    await recordAuthEvent({ type: "INVITE_SENT", userId: target.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, resend: true } }, tx);
    return { user: await tx.user.findUniqueOrThrow({ where: { id }, select: userRefSelect }), raw };
  });
  const emailSent = await sendInviteEmail(user.email, user.name, raw).then(
    () => true,
    (err) => (console.error("[access] invite email failed", err), false),
  );
  return { ...user, emailSent };
}

// ACC-R1, R2, R3, R9, R16.
export async function updateUser(data: UpdateUserData, ctx: ServiceContext): Promise<UserRef> {
  return db.$transaction(async (tx) => {
    const target = await findTarget(data.id, ctx.actor, tx);
    const roleChanges = data.role !== undefined && data.role !== target.role;
    if (roleChanges) {
      assertNotSelf(target.id, ctx.actor, "change the role of");
      assertCanAssign(ctx.actor, data.role!);
      if (target.role === "SUPER_ADMIN") await assertSuperAdminRemains(target.id, tx);
    }
    const user = await tx.user.update({ where: { id: data.id }, data: { name: data.name, phone: data.phone, role: data.role }, select: userRefSelect });
    if (roleChanges) {
      await recordAuthEvent({ type: "ROLE_CHANGED", userId: target.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, oldRole: target.role, newRole: data.role } }, tx);
    }
    if (data.name !== undefined || data.phone !== undefined) {
      await recordAuthEvent({ type: "USER_UPDATED", userId: target.id, ...ctx.meta, metadata: { actorId: ctx.actor.id } }, tx);
    }
    return user;
  });
}

// ACC-R1, R2, R3, R9.
export async function setUserActive(data: SetUserActiveData, ctx: ServiceContext): Promise<UserRef> {
  return db.$transaction(async (tx) => {
    const target = await findTarget(data.id, ctx.actor, tx);
    if (target.isActive === data.isActive) throw Errors.conflict(data.isActive ? "This user is already active." : "This user is already inactive.");
    if (!data.isActive) {
      assertNotSelf(target.id, ctx.actor, "deactivate");
      if (target.role === "SUPER_ADMIN") await assertSuperAdminRemains(target.id, tx);
    }
    const user = await tx.user.update({ where: { id: data.id }, data: { isActive: data.isActive }, select: userRefSelect });
    await recordAuthEvent(
      { type: data.isActive ? "USER_UPDATED" : "USER_DEACTIVATED", userId: target.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, isActive: data.isActive } },
      tx,
    );
    return user;
  });
}

// ACC-R1, R5, R9: an admin sends a reset link.
export async function sendPasswordReset({ id }: UserIdData, ctx: ServiceContext): Promise<{ emailSent: boolean }> {
  const { user, raw } = await db.$transaction(async (tx) => {
    const target = await findTarget(id, ctx.actor, tx);
    if (target.password === NO_PASSWORD) throw Errors.conflict("This user has not accepted the invite yet. Resend the invite instead.");
    if (!target.isActive) throw Errors.conflict("This user is inactive.");
    const raw = await issueToken(target.id, "PASSWORD_RESET", tx);
    await recordAuthEvent({ type: "PASSWORD_RESET_REQUESTED", userId: target.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, email: target.email } }, tx);
    return { user: target, raw };
  });
  const emailSent = await sendResetEmail(user.email, user.name, raw).then(
    () => true,
    (err) => (console.error("[access] reset email failed", err), false),
  );
  return { emailSent };
}

// ACC-R1, R2, R3, R12.
export async function deleteUser({ id }: UserIdData, ctx: ServiceContext): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const target = await findTarget(id, ctx.actor, tx);
    assertNotSelf(target.id, ctx.actor, "delete");
    if (target.role === "SUPER_ADMIN") await assertSuperAdminRemains(target.id, tx);
    const handled = await tx.user.findUniqueOrThrow({
      where: { id },
      select: { _count: { select: { equipmentRequests: true, supplyOrders: true, serviceRequests: true, workforceRequests: true } } },
    });
    const c = handled._count;
    if (c.equipmentRequests + c.supplyOrders + c.serviceRequests + c.workforceRequests > 0) {
      throw Errors.conflict("This user handles requests. Deactivate the user instead.");
    }
    await tx.user.delete({ where: { id } });
    await recordAuthEvent({ type: "USER_DELETED", userId: ctx.actor.id, ...ctx.meta, metadata: { actorId: ctx.actor.id, targetUserId: id, targetEmail: target.email } }, tx);
    return { id };
  });
}

// ======================= Writes (the signed-in user) =======================

// ACC-R8, R9, R10: other sessions end; the browser signs in again.
export async function changeOwnPassword(data: ChangeOwnPasswordData, ctx: ServiceContext): Promise<{ email: string }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.actor.id }, select: { email: true, password: true } });
  if (!(await bcrypt.compare(data.currentPassword, user.password || DUMMY_HASH))) {
    throw Errors.invalid("Your current password is not correct.", { currentPassword: ["Not correct."] });
  }
  if (data.currentPassword === data.newPassword) throw Errors.invalid("Choose a new password.", { newPassword: ["Same as the current one."] });
  const hash = await hashPassword(data.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.actor.id }, data: { password: hash, mustChangePassword: false } });
    await recordAuthEvent({ type: "PASSWORD_CHANGED", userId: ctx.actor.id, ...ctx.meta }, tx);
  });
  return { email: user.email };
}

// ACC-R5, R11: the new address is carried inside the token (only its hash is stored).
export async function requestEmailChange(data: { newEmail: string }, ctx: ServiceContext): Promise<{ emailSent: boolean }> {
  const taken = await db.user.findUnique({ where: { email: data.newEmail }, select: { id: true } });
  if (taken) throw Errors.conflict("This email is already in use.", { newEmail: ["Already in use."] });
  const raw = await db.$transaction(async (tx) => {
    const raw = await issueToken(ctx.actor.id, "EMAIL_VERIFY", tx, data.newEmail);
    await recordAuthEvent({ type: "USER_UPDATED", userId: ctx.actor.id, ...ctx.meta, metadata: { emailChangeRequested: data.newEmail } }, tx);
    return raw;
  });
  const emailSent = await sendVerifyEmail(data.newEmail, ctx.actor.name, raw).then(
    () => true,
    (err) => (console.error("[access] verify email failed", err), false),
  );
  return { emailSent };
}

// ======================= Writes (public, token-protected) =======================

// PUBLIC (ACC-R5, R8, R9).
export async function acceptInvite(data: AcceptInviteData, meta: RequestMeta): Promise<{ email: string }> {
  const hash = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    const { userId } = await consumeToken(data.token, "INVITE", tx);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true, password: true } });
    if (!user || !user.isActive) throw invalidLink();
    if (user.password !== NO_PASSWORD) throw Errors.conflict("This invite was already accepted. Sign in instead.");
    await tx.user.update({ where: { id: userId }, data: { password: hash, mustChangePassword: false } });
    await recordAuthEvent({ type: "INVITE_ACCEPTED", userId, ...meta }, tx);
    return { email: user.email };
  });
}

// PUBLIC (ACC-R6, R7). Always the same answer.
export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<{ message: string }> {
  const message = "If the email exists, we sent a link.";
  const limits = ACCESS_CONFIG.limits;
  const [byEmail, byIp] = await Promise.all([
    countRecentEvents({ type: "PASSWORD_RESET_REQUESTED", windowMs: limits.resetPerEmail.windowMs, email }, db),
    countRecentEvents({ type: "PASSWORD_RESET_REQUESTED", windowMs: limits.resetPerIp.windowMs, ip: meta.ip }, db),
  ]);
  if (byIp >= limits.resetPerIp.max) throw Errors.rateLimited();
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true, password: true } });
  const eligible = !!user && user.isActive && user.password !== NO_PASSWORD && byEmail < limits.resetPerEmail.max;
  const raw = await db.$transaction(async (tx) => {
    await recordAuthEvent({ type: "PASSWORD_RESET_REQUESTED", userId: user?.id, ...meta, metadata: { email } }, tx);
    return eligible ? issueToken(user!.id, "PASSWORD_RESET", tx) : null;
  });
  if (raw && user) await sendResetEmail(user.email, user.name, raw).catch((err) => console.error("[access] reset email failed", err));
  return { message };
}

// PUBLIC (ACC-R5, R8, R9, R10).
export async function resetPassword(data: ResetPasswordData, meta: RequestMeta): Promise<{ email: string }> {
  const hash = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    const { userId } = await consumeToken(data.token, "PASSWORD_RESET", tx);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
    if (!user || !user.isActive) throw invalidLink();
    await tx.user.update({ where: { id: userId }, data: { password: hash, mustChangePassword: false } });
    await recordAuthEvent({ type: "PASSWORD_RESET_DONE", userId, ...meta }, tx);
    return { email: user.email };
  });
}

// PUBLIC (ACC-R5, R11).
export async function verifyEmail(token: string, meta: RequestMeta): Promise<{ email: string }> {
  return db.$transaction(async (tx) => {
    const { userId, email } = await consumeToken(token, "EMAIL_VERIFY", tx);
    if (!email) throw invalidLink();
    const taken = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== userId) throw Errors.conflict("This email is already in use.");
    const before = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!before) throw invalidLink();
    await tx.user.update({ where: { id: userId }, data: { email } });
    await recordAuthEvent({ type: "EMAIL_VERIFIED", userId, ...meta, metadata: { oldEmail: before.email, newEmail: email } }, tx);
    return { email };
  });
}

// ======================= Shared with scripts =======================

// The seed and scripts/reset-super-admin.ts issue tokens through these.
export { issueToken };

// ======================= Helpers (not exported) =======================

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ACCESS_CONFIG.passwords.bcryptCost);
}

// ACC-R5: 32 random bytes; EMAIL_VERIFY carries the new address after a dot.
// Retires older unused tokens of the same type first.
async function issueToken(userId: string, type: TokenType, client: DbClient, newEmail?: string): Promise<string> {
  const random = newRawToken();
  const raw = newEmail ? `${random}.${Buffer.from(newEmail).toString("base64url")}` : random;
  const now = new Date();
  await client.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
  await client.authToken.create({
    data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + ACCESS_CONFIG.tokens[type]) },
  });
  return raw;
}

// ACC-R5: right type, unused, not expired; marked used in the same statement.
async function consumeToken(raw: string, type: TokenType, client: DbClient): Promise<{ userId: string; email: string | null }> {
  const tokenHash = hashToken(raw);
  const row = await client.authToken.findUnique({ where: { tokenHash }, select: { id: true, type: true, userId: true, usedAt: true, expiresAt: true } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) throw invalidLink();
  const { count } = await client.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count === 0) throw invalidLink();
  const dot = raw.indexOf(".");
  const email = dot > 0 ? Buffer.from(raw.slice(dot + 1), "base64url").toString() : null;
  return { userId: row.userId, email };
}

const invalidLink = () => Errors.invalid("This link is invalid or has expired. Ask for a new one.", { token: ["Invalid or expired."] });

// ACC-R2.
function assertNotSelf(targetId: string, actor: SessionUser, verb: string) {
  if (targetId === actor.id) throw Errors.forbidden(`You cannot ${verb} yourself.`);
}

// ACC-R16.
function assertCanAssign(actor: SessionUser, role: Role) {
  if (!assignableRoles(actor).includes(role)) throw Errors.forbidden("You cannot give this role.");
}

// ACC-R3: parallel calls take turns, so two removals cannot both pass.
async function assertSuperAdminRemains(targetId: string, client: DbClient) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('access:super-admins'))`;
  const others = await client.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: targetId } } });
  if (others === 0) throw Errors.conflict("At least one active Super Admin must remain.");
}
