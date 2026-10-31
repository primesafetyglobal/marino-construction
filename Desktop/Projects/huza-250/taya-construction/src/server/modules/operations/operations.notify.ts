// OPERATIONS NOTIFY: staff emails about new requests (OPS-R15). Server-only.
// Called after commit; callers catch failures, so an email never fails a request.

import "server-only";
import { appUrl, brandedEmail, sendMail } from "@/server/integrations/mailer";
import { REQUEST_ADMIN_PATH, requestCode, type RequestKind } from "./operations.reference";

const LABEL: Record<RequestKind, string> = {
  EQUIPMENT_REQUEST: "Equipment request",
  SUPPLY_ORDER: "Supply order",
  SERVICE_REQUEST: "Service request",
  WORKFORCE_REQUEST: "Workforce request",
};

export async function notifyNewRequest(kind: RequestKind, row: { id: string; number: number; clientName: string; summary: string }) {
  const to = process.env.STAFF_NOTIFY_EMAIL;
  if (!to) return;
  const code = requestCode(kind, row.number);
  const mail = brandedEmail({
    title: `New ${LABEL[kind].toLowerCase()} ${code}`,
    lines: [`Client: ${row.clientName}`, row.summary],
    button: { label: "Open in dashboard", url: appUrl(`${REQUEST_ADMIN_PATH[kind]}/${row.id}`) },
  });
  await sendMail({ to, subject: `${code} · ${LABEL[kind]} from ${row.clientName}`, ...mail });
}
