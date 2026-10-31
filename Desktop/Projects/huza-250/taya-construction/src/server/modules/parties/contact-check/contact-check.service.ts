// CONTACT CHECK SERVICE (flow): does this phone or email belong to a stored
// client, vendor or applicant? Answers only { known } (PTY-R14); never returns
// stored details. Rate-limited: 10 per minute per hashed IP.

import "server-only";
import { db } from "@/server/validation/db";
import { checkRateLimit } from "@/server/validation/rate-limit";
import type { RequestMeta } from "@/server/validation/request";
import { normalizeEmail, normalizePhone } from "../parties.fields";
import type { ContactCheckData } from "./contact-check.schema";
import type { ContactCheckResult } from "./contact-check.select";

export async function checkContact(data: ContactCheckData, meta: RequestMeta): Promise<ContactCheckResult> {
  checkRateLimit({ scope: "contact-check", ip: meta.ip, limit: 10, windowMs: 60_000 });
  const phone = normalizePhone(data.phone);
  const email = normalizeEmail(data.email);
  const or = [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])];
  if (!or.length) return { known: false };
  const where = { OR: or };
  const found =
    data.for === "client"
      ? await db.client.findFirst({ where, select: { id: true } })
      : data.for === "vendor"
        ? await db.vendor.findFirst({ where, select: { id: true } })
        : await db.applicant.findFirst({ where, select: { id: true } });
  return { known: !!found };
}
