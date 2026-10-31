// Shared state for the database tests: who is signed in, the request IP, sent
// mail. setup.ts wires the framework mocks to this state.

import type { MailMessage } from "@/server/integrations/mailer";

export const harness = {
  session: null as { user: { id: string }; loginAt: number } | null,
  headers: {} as Record<string, string>,
  mails: [] as MailMessage[],
  mailFails: false,
};

export function resetHarness() {
  harness.session = null;
  harness.headers = { "x-forwarded-for": "10.0.0.1", "user-agent": "vitest" };
  harness.mails = [];
  harness.mailFails = false;
}
