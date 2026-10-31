import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

// Smoke flows (Delivery §5, flows 2, 10 (invite part) and 6) against a
// separate database: <DATABASE_URL name>_e2e, rebuilt on every run.
const env = { ...loadDotenv({ quiet: true, processEnv: {} }).parsed, ...process.env } as Record<string, string>;
const base = new URL(env.DATABASE_URL ?? "postgresql://localhost:5432/marino");
base.pathname = `${base.pathname}_e2e`;
const PORT = 3100;
export const E2E = {
  databaseUrl: base.toString(),
  outbox: `${process.cwd()}/test-results/e2e-outbox.jsonl`,
  superAdmin: { email: "e2e-super@example.test", password: "e2e-super-password" },
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // PW_CHROME_CHANNEL=chrome uses the installed Google Chrome instead of Playwright's download.
    ...(process.env.PW_CHROME_CHANNEL ? { channel: process.env.PW_CHROME_CHANNEL } : {}),
  },
  webServer: {
    command: `npx tsx --tsconfig scripts/tsconfig.scripts.json tests/e2e/prepare.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E.databaseUrl,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      APP_URL: `http://localhost:${PORT}`,
      MAIL_DEV_OUTBOX: E2E.outbox,
      RESEND_API_KEY: "",
      STAFF_NOTIFY_EMAIL: "staff@example.test",
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      S3_BUCKET: "",
      SUPER_ADMIN_EMAIL: E2E.superAdmin.email,
      SUPER_ADMIN_PASS: E2E.superAdmin.password,
    },
  },
});
