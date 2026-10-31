// RESET SUPER ADMIN: prints (and emails, when mail is configured) a password
// reset link for a Super Admin. The fallback when login or email is broken.
// Run on the server only:
//
//   npm run auth:reset-super-admin -- owner@example.com

import { db } from "../src/server/validation/db";
import { appUrl, brandedEmail, isMailConfigured, sendMail } from "../src/server/integrations/mailer";
import { hashToken, newRawToken } from "../src/server/modules/access/access.tokens";
import { ACCESS_CONFIG, ACCESS_PATHS } from "../src/server/modules/access/access.config";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run auth:reset-super-admin -- <email>");
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true, password: true } });
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("No Super Admin with this email.");
  const type = user.password === "" ? "INVITE" : "PASSWORD_RESET";
  const raw = newRawToken();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { isActive: true } }),
    db.authToken.updateMany({ where: { userId: user.id, type, usedAt: null }, data: { usedAt: new Date() } }),
    db.authToken.create({ data: { userId: user.id, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ACCESS_CONFIG.tokens[type]) } }),
    db.authEvent.create({ data: { type: type === "INVITE" ? "INVITE_SENT" : "PASSWORD_RESET_REQUESTED", userId: user.id, metadata: { by: "reset-super-admin script", email }, createdAt: new Date() } }),
  ]);
  const link = appUrl(type === "INVITE" ? ACCESS_PATHS.invite(raw) : ACCESS_PATHS.reset(raw));
  console.log(`\n${type === "INVITE" ? "Invite" : "Reset"} link for ${email}:\n  ${link}\n`);
  if (isMailConfigured()) {
    const mail = brandedEmail({ title: "Set your Marino dashboard password", lines: ["Use the link below to set your password."], button: { label: "Set my password", url: link } });
    await sendMail({ to: email, subject: "Marino dashboard password", ...mail }).catch((err) => console.error("Email failed (use the printed link):", err));
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
