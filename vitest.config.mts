import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const resolve = {
  alias: {
    "@": fromRoot("./src"),
    // "server-only" throws outside the react-server condition. Tests run the
    // server files directly, so it becomes an empty module here.
    "server-only": fromRoot("./tests/stubs/server-only.ts"),
  },
};

// The tests wipe the database, so its name MUST end in "_test".
// TEST_DATABASE_URL if set, otherwise DATABASE_URL with "_test" appended.
function testDatabaseUrl(env: Record<string, string | undefined>): string {
  const explicit = env.TEST_DATABASE_URL;
  const base = explicit ?? env.DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL (or DATABASE_URL) to run the database tests.");
  const url = new URL(base);
  if (!explicit) url.pathname = `${url.pathname}_test`;
  const name = url.pathname.slice(1);
  if (!name.endsWith("_test")) throw new Error(`Refusing to run tests on "${name}": the database name must end in "_test".`);
  return url.toString();
}

export default defineConfig(() => {
  const env = { ...loadDotenv({ quiet: true, processEnv: {} }).parsed, ...process.env };
  return {
    test: {
      projects: [
        { resolve, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
        {
          resolve,
          test: {
            name: "db",
            environment: "node",
            include: ["tests/*.test.ts", "tests/{catalog,operations,parties,access,filing}/**/*.test.ts"],
            globalSetup: ["tests/auth/global-setup.ts"],
            setupFiles: ["tests/auth/setup.ts"],
            fileParallelism: false, // one shared database
            testTimeout: 30_000,
            hookTimeout: 60_000,
            env: {
              DATABASE_URL: testDatabaseUrl(env),
              NEXTAUTH_SECRET: "test-nextauth-secret-0123456789abcdef",
              STAFF_NOTIFY_EMAIL: "staff@example.test",
              RESEND_API_KEY: "",
              TURNSTILE_SECRET_KEY: "",
              S3_BUCKET: "",
            },
          },
        },
      ],
    },
  };
});
