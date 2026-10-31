// ACCESS EMAILS: invite, password reset and email verification messages.
// Server-only. Sent after commit; callers catch failures.

import "server-only";
import { appUrl, brandedEmail, sendMail } from "@/server/integrations/mailer";
import { ACCESS_PATHS } from "./access.config";

export async function sendInviteEmail(to: string, name: string, rawToken: string) {
  const mail = brandedEmail({
    title: "You're invited to the Marino dashboard",
    lines: [`Hello ${name},`, "You have been invited to the Marino Construction staff dashboard. Set your password with the link below. It works once and expires in 7 days."],
    button: { label: "Set my password", url: appUrl(ACCESS_PATHS.invite(rawToken)) },
  });
  await sendMail({ to, subject: "Your Marino dashboard invite", ...mail });
}

export async function sendResetEmail(to: string, name: string, rawToken: string) {
  const mail = brandedEmail({
    title: "Reset your password",
    lines: [`Hello ${name},`, "Use the link below to set a new password. It works once and expires in 1 hour. If you did not ask for this, ignore this email."],
    button: { label: "Set a new password", url: appUrl(ACCESS_PATHS.reset(rawToken)) },
  });
  await sendMail({ to, subject: "Reset your Marino dashboard password", ...mail });
}

export async function sendVerifyEmail(to: string, name: string, rawToken: string) {
  const mail = brandedEmail({
    title: "Confirm your new email",
    lines: [`Hello ${name},`, "Confirm this address for your Marino dashboard account. The link works once and expires in 24 hours."],
    button: { label: "Confirm email", url: appUrl(ACCESS_PATHS.verifyEmail(rawToken)) },
  });
  await sendMail({ to, subject: "Confirm your new email", ...mail });
}

export function inviteLink(rawToken: string) {
  return appUrl(ACCESS_PATHS.invite(rawToken));
}

export function resetLink(rawToken: string) {
  return appUrl(ACCESS_PATHS.reset(rawToken));
}
