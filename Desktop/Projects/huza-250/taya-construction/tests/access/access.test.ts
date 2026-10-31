// Access & feedback rules (docs/modules/access.md).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/validation/db";
import { getUser as currentUser, ROLE_PERMISSIONS } from "@/server/validation/auth";
import * as users from "@/server/modules/access/user/user.actions";
import * as userQueries from "@/server/modules/access/user/user.queries";
import * as userRoutes from "@/server/modules/access/user/user.routes";
import * as eventQueries from "@/server/modules/access/auth-event/auth-event.queries";
import * as reviews from "@/server/modules/access/review/review.actions";
import * as reviewQueries from "@/server/modules/access/review/review.queries";
import * as userService from "@/server/modules/access/user/user.service";
import { verifyLogin } from "@/server/modules/access/user/user.service";
import { hashToken } from "@/server/modules/access/access.tokens";
import { harness } from "../auth/harness";
import { callRoute, forbiddenKeys, makeClient, makeUser, PASSWORD, resetDb, settle, signInAs } from "../auth/fixtures";

const meta = (ip = "10.1.1.1") => ({ ip, userAgent: "vitest" });
const linkToken = (text: string) => text.match(/\/(?:invite|reset-password|verify-email)\/([\w.-]+)/)![1];

beforeEach(resetDb);

describe("access rules", () => {
  it("ACC-R1 an ADMIN never sees a SUPER_ADMIN, its events, or can target it (NOT_FOUND)", async () => {
    const sa = await makeUser({ role: "SUPER_ADMIN" });
    const admin = await makeUser({ role: "ADMIN" });
    await db.authEvent.create({ data: { type: "LOGIN_SUCCESS", userId: sa.id } });
    signInAs(admin);
    const list = await userQueries.listUsers({});
    expect(list.view === "admin" && list.items.map((u) => u.id)).not.toContain(sa.id);
    expect(await settle(() => userQueries.getUser({ id: sa.id }))).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect((await callRoute(userRoutes.getUserRoute, `/api/v1/access/user/${sa.id}`, { id: sa.id })).status).toBe(404);
    for (const r of [await users.setUserActive({ id: sa.id, isActive: false }), await users.updateUser({ id: sa.id, name: "X Y" }), await users.deleteUser({ id: sa.id }), await users.sendPasswordReset({ id: sa.id })]) {
      expect(r).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    }
    expect((await eventQueries.listAuthEvents({})).items).toHaveLength(0);
    expect(await settle(() => eventQueries.getUserActivity({ userId: sa.id }))).toMatchObject({ ok: false, code: "NOT_FOUND" });
    signInAs(sa);
    expect((await eventQueries.listAuthEvents({})).items).toHaveLength(1);
  });

  it("ACC-R2 nobody deletes, deactivates or changes the role of themselves", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    signInAs(admin);
    expect(await users.deleteUser({ id: admin.id })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await users.setUserActive({ id: admin.id, isActive: false })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await users.updateUser({ id: admin.id, role: "STAFF" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await users.updateUser({ id: admin.id, name: "New Name" })).toMatchObject({ ok: true });
  });

  it("ACC-R3 the last active SUPER_ADMIN cannot be removed, also when two remove each other at once", async () => {
    const a = await makeUser({ role: "SUPER_ADMIN" });
    const b = await makeUser({ role: "SUPER_ADMIN" });
    const ctx = (u: { id: string; name: string; email: string }) => ({
      actor: { ...u, role: "SUPER_ADMIN" as const, permissions: ROLE_PERMISSIONS.SUPER_ADMIN },
      meta: meta(),
    });
    // Each deactivates the other in parallel: the advisory lock makes them take turns.
    const results = await Promise.allSettled([userService.setUserActive({ id: b.id, isActive: false }, ctx(a)), userService.setUserActive({ id: a.id, isActive: false }, ctx(b))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.user.count({ where: { role: "SUPER_ADMIN", isActive: true } })).toBe(1);
    // Demoting or deleting the last one is refused the same way.
    const last = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
    const off = last.id === a.id ? b : a;
    await expect(userService.updateUser({ id: last.id, role: "ADMIN" }, ctx(off))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(userService.deleteUser({ id: last.id }, ctx(off))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("ACC-R4 inactive and invite-pending users cannot log in", async () => {
    const off = await makeUser({ active: false, email: "off@example.test" });
    const pending = await makeUser({ invitePending: true, email: "pending@example.test" });
    expect(await verifyLogin({ email: off.email, password: PASSWORD }, meta())).toEqual({ ok: false, reason: "INVALID" });
    expect(await verifyLogin({ email: pending.email, password: "" }, meta())).toEqual({ ok: false, reason: "INVALID" });
    const on = await makeUser({ email: "on@example.test" });
    expect(await verifyLogin({ email: on.email, password: PASSWORD }, meta())).toMatchObject({ ok: true });
  });

  it("ACC-R5 tokens are hashed, single use, expire, and a new one retires the old one", async () => {
    signInAs(await makeUser({ role: "ADMIN" }));
    await users.inviteUser({ name: "New Staff", email: "new@example.test", role: "STAFF" });
    const first = linkToken(harness.mails[0].text);
    expect(await db.authToken.findUnique({ where: { tokenHash: first } })).toBeNull();
    expect(await db.authToken.findUnique({ where: { tokenHash: hashToken(first) } })).not.toBeNull();
    const target = await db.user.findUniqueOrThrow({ where: { email: "new@example.test" } });
    await users.resendInvite({ id: target.id });
    const second = linkToken(harness.mails[1].text);
    signInAs(null);
    expect(await users.acceptInvite({ token: first, password: "a-long-password", confirmPassword: "a-long-password" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await users.acceptInvite({ token: second, password: "a-long-password", confirmPassword: "a-long-password" })).toMatchObject({ ok: true, data: { email: "new@example.test" } });
    expect(await users.acceptInvite({ token: second, password: "a-long-password", confirmPassword: "a-long-password" })).toMatchObject({ ok: false });
    // Expiry.
    await users.requestPasswordReset({ email: "new@example.test" });
    const reset = linkToken(harness.mails[2].text);
    await db.authToken.update({ where: { tokenHash: hashToken(reset) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await users.resetPassword({ token: reset, password: "another-password", confirmPassword: "another-password" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("ACC-R6 forgot password answers the same for a real and an unknown email", async () => {
    await makeUser({ email: "real@example.test" });
    signInAs(null);
    const real = await users.requestPasswordReset({ email: "real@example.test" });
    const fake = await users.requestPasswordReset({ email: "nobody@example.test" });
    expect(real).toEqual(fake);
    expect(harness.mails).toHaveLength(1);
  });

  it("ACC-R7 the 6th login after 5 failures for an email is blocked; 20 per IP; reset requests 3 per email per hour", async () => {
    const u = await makeUser({ email: "target@example.test" });
    for (let i = 0; i < 5; i++) expect(await verifyLogin({ email: u.email, password: "wrong" }, meta(`10.0.0.${i}`))).toEqual({ ok: false, reason: "INVALID" });
    expect(await verifyLogin({ email: u.email, password: PASSWORD }, meta("10.9.9.9"))).toEqual({ ok: false, reason: "RATE_LIMITED" });
    for (let i = 0; i < 20; i++) await verifyLogin({ email: `ghost${i}@example.test`, password: "x" }, meta("10.7.7.7"));
    const other = await makeUser({ email: "other@example.test" });
    expect(await verifyLogin({ email: other.email, password: PASSWORD }, meta("10.7.7.7"))).toEqual({ ok: false, reason: "RATE_LIMITED" });
    signInAs(null);
    for (let i = 0; i < 4; i++) await users.requestPasswordReset({ email: "other@example.test" });
    expect(harness.mails).toHaveLength(3);
  });

  it("ACC-R8 passwords are ≥ 10 characters, bcrypt-hashed and never returned", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    signInAs(admin);
    await users.inviteUser({ name: "Pat Staff", email: "pat@example.test", role: "STAFF" });
    const token = linkToken(harness.mails[0].text);
    signInAs(null);
    expect(await users.acceptInvite({ token, password: "short", confirmPassword: "short" })).toMatchObject({ ok: false, error: { fieldErrors: { password: expect.any(Array) } } });
    await users.acceptInvite({ token, password: "long-enough-pass", confirmPassword: "long-enough-pass" });
    expect((await db.user.findUniqueOrThrow({ where: { email: "pat@example.test" } })).password).toMatch(/^\$2[aby]\$/);
    signInAs(admin);
    const list = await userQueries.listUsers({});
    expect(forbiddenKeys(list, ["password", "tokenHash"])).toEqual([]);
  });

  it("ACC-R9 logins, failures, invites, resets and role changes write AuthEvents without secrets", async () => {
    const admin = await makeUser({ role: "ADMIN", email: "admin@example.test" });
    await verifyLogin({ email: admin.email, password: PASSWORD }, meta());
    await verifyLogin({ email: admin.email, password: "nope" }, meta());
    signInAs(admin);
    await users.inviteUser({ name: "Sam Staff", email: "sam@example.test", role: "STAFF" });
    const sam = await db.user.findUniqueOrThrow({ where: { email: "sam@example.test" } });
    await users.updateUser({ id: sam.id, role: "ADMIN" });
    const types = (await db.authEvent.findMany({ select: { type: true } })).map((e) => e.type).sort();
    expect(types).toEqual(["INVITE_SENT", "LOGIN_FAILED", "LOGIN_SUCCESS", "ROLE_CHANGED"]);
    const events = await db.authEvent.findMany({ select: { metadata: true } });
    expect(JSON.stringify(events)).not.toContain("nope"); // the typed password is never stored
    expect(forbiddenKeys(events, ["password", "token", "tokenHash", "newPassword", "currentPassword"])).toEqual([]);
  });

  it("ACC-R10 a session older than the latest password change is signed out", async () => {
    const u = await makeUser();
    signInAs(u, Date.now() - 60_000);
    expect(await currentUser()).not.toBeNull();
    signInAs(u, Date.now() - 60_000);
    expect(await users.changeOwnPassword({ currentPassword: PASSWORD, newPassword: "brand-new-password", confirmPassword: "brand-new-password" })).toMatchObject({ ok: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 1000));
    signInAs(u, Date.now() - 60_000); // the old session
    expect(await settle(() => userQueries.getCurrentUser({}))).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    signInAs(u, Date.now()); // signed in again after the change
    expect(await settle(() => userQueries.getCurrentUser({}))).toMatchObject({ ok: true });
    vi.useRealTimers();
  });

  it("ACC-R11 a new email is saved only after its verification link is used", async () => {
    const u = await makeUser({ email: "old@example.test" });
    signInAs(u);
    expect(await users.requestEmailChange({ newEmail: "new@example.test" })).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe("old@example.test");
    expect(harness.mails[0].to).toBe("new@example.test");
    signInAs(null);
    const token = linkToken(harness.mails[0].text);
    expect(await users.verifyEmail({ token })).toMatchObject({ ok: true, data: { email: "new@example.test" } });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe("new@example.test");
    expect(await users.verifyEmail({ token })).toMatchObject({ ok: false });
  });

  it("ACC-R12 a user who handles requests cannot be deleted", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const busy = await makeUser();
    const client = await makeClient();
    await db.supplyOrder.create({ data: { clientId: client.id, items: "x", deliveryLocation: "y", handledById: busy.id } });
    signInAs(admin);
    expect(await users.deleteUser({ id: busy.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const idle = await makeUser();
    expect(await users.deleteUser({ id: idle.id })).toMatchObject({ ok: true });
  });

  it("ACC-R13 reviews: rating 1-5, saved NEW, only PUBLIC ones public without contact; staff only change status", async () => {
    signInAs(null);
    const base = { fullName: "Happy Client", rating: 5, message: "Great work!", phone: "0788000555", consent: true as const };
    expect(await reviews.submitReview({ ...base, rating: 6 })).toMatchObject({ ok: false, error: { fieldErrors: { rating: expect.any(Array) } } });
    expect(await reviews.submitReview(base)).toEqual({ ok: true, data: { received: true } });
    const row = await db.review.findFirstOrThrow();
    expect(row.status).toBe("NEW");
    expect((await reviewQueries.getPublicReviews({})).items).toHaveLength(0);
    signInAs(await makeUser());
    expect(await reviews.setReviewStatus({ id: row.id, status: "PUBLIC" })).toMatchObject({ ok: true });
    expect(await reviews.setReviewStatus({ id: row.id, status: "PUBLIC", message: "edited" } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    signInAs(null);
    const pub = await reviewQueries.getPublicReviews({});
    expect(pub.items).toHaveLength(1);
    expect(forbiddenKeys(pub, ["phone", "email", "clientId", "client", "status"])).toEqual([]);
    expect(await reviewQueries.getReviewSummary({})).toEqual({ average: 5, count: 1 });
  });

  it("ACC-R14 a review is linked to the client whose phone or email matches", async () => {
    const client = await makeClient({ phone: "+250788000666" });
    signInAs(null);
    await reviews.submitReview({ fullName: "Jean", rating: 4, message: "Good service.", phone: "0788 000 666", consent: true });
    expect((await db.review.findFirstOrThrow()).clientId).toBe(client.id);
  });

  it("ACC-R15 public review form: honeypot fake success; consent required; 6th in a minute is RATE_LIMITED", async () => {
    signInAs(null);
    const base = { fullName: "Someone", rating: 4, message: "Nice job.", consent: true as const };
    expect(await reviews.submitReview({ ...base, fax: "x" })).toEqual({ ok: true, data: { received: true } });
    expect(await db.review.count()).toBe(0);
    expect(await reviews.submitReview({ ...base, consent: false } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    for (let i = 0; i < 5; i++) await reviews.submitReview(base);
    expect(await reviews.submitReview(base)).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });

  it("ACC-R16 an ADMIN gives only ADMIN / STAFF roles; a SUPER_ADMIN may give SUPER_ADMIN", async () => {
    signInAs(await makeUser({ role: "ADMIN" }));
    expect(await users.inviteUser({ name: "Boss", email: "boss@example.test", role: "SUPER_ADMIN" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await users.inviteUser({ name: "Helper", email: "helper@example.test", role: "ADMIN" })).toMatchObject({ ok: true });
    signInAs(await makeUser({ role: "SUPER_ADMIN" }));
    expect(await users.inviteUser({ name: "Boss", email: "boss@example.test", role: "SUPER_ADMIN" })).toMatchObject({ ok: true });
  });
});
