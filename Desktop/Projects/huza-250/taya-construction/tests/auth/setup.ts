// Per-file setup for the database tests: replaces the framework edges (session,
// request headers, cache revalidation, mail delivery) with test doubles.
// Everything else, including the database, is real.

import { afterAll, beforeEach, vi } from "vitest";
import { harness, resetHarness } from "./harness";

vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-auth")>()),
  getServerSession: vi.fn(async () => harness.session),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(harness.headers)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/integrations/mailer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/integrations/mailer")>()),
  sendMail: vi.fn(async (message: import("@/server/integrations/mailer").MailMessage) => {
    if (harness.mailFails) throw new Error("Mail down (test)");
    harness.mails.push(message);
  }),
}));

beforeEach(async () => {
  resetHarness();
  const { resetRateLimits } = await import("@/server/validation/rate-limit");
  resetRateLimits();
});

afterAll(async () => {
  const { db } = await import("@/server/validation/db");
  await db.$disconnect();
});
