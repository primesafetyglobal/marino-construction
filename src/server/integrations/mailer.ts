// MAILER: the one way the server sends email.
//
// Contract: sendMail({ to, subject, html, text }) resolves when the message is
// handed over and THROWS on failure. Callers send after their transaction
// commits and catch the error (DNSA ch. 22).
//
// Two implementations behind the same function:
// - Resend (HTTP API) when RESEND_API_KEY is set. No SDK: one fetch call.
// - Without RESEND_API_KEY: messages are printed to the server console, so
//   links (invite, reset, verify) can be followed locally. In production the
//   send then throws, so a missing key is loud (callers log it).

import "server-only";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const from = process.env.MAIL_FROM;
    if (!from) throw new Error("MAIL_FROM is not set.");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!res.ok) throw new Error(`Resend refused the message (${res.status}).`);
    return;
  }
  if (process.env.NODE_ENV === "production") {
    console.info(`[mailer] not configured; message to ${message.to} not sent.`);
    throw new Error("Mailer is not configured: set RESEND_API_KEY and MAIL_FROM.");
  }
  // DEV ONLY: console mailer (and an optional JSON-lines outbox file for the e2e tests).
  console.info(`\n[dev-mailer] To: ${message.to}\n[dev-mailer] Subject: ${message.subject}\n${message.text}\n`);
  const outbox = process.env.MAIL_DEV_OUTBOX;
  if (outbox) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(outbox, `${JSON.stringify({ to: message.to, subject: message.subject, text: message.text })}\n`);
  }
}

// A simple branded layout shared by every email (Design §8).
export function brandedEmail(opts: { title: string; lines: string[]; button?: { label: string; url: string } }): {
  html: string;
  text: string;
} {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><html><body style="margin:0;background:#F5F5F7;font-family:Inter,Arial,sans-serif;color:#1D1D1F">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:#16181D;padding:20px 28px;color:#fff;font-weight:700;font-size:18px">MARINO <span style="color:#F5B301">Construction</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${esc(opts.title)}</h1>
${opts.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${esc(l)}</p>`).join("")}
${opts.button ? `<p style="margin:24px 0 0"><a href="${esc(opts.button.url)}" style="background:#F5B301;color:#16181D;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;display:inline-block">${esc(opts.button.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const text = [opts.title, "", ...opts.lines, ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : [])].join("\n");
  return { html, text };
}

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
