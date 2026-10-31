// Prepares the e2e database before the dev server starts: create, wipe,
// migrate, seed (with demo data; the Super Admin comes from SUPER_ADMIN_EMAIL /
// SUPER_ADMIN_PASS), and add a second open job for the returning-applicant flow.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Client } from "pg";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = url.pathname.slice(1);
  if (!name.endsWith("_e2e")) throw new Error(`Refusing to prepare "${name}": the e2e database name must end in "_e2e".`);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const server = new Client({ connectionString: admin.toString() });
  await server.connect();
  const { rowCount } = await server.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!rowCount) await server.query(`CREATE DATABASE "${name}"`);
  await server.end();
  const pg = new Client({ connectionString: url.toString() });
  await pg.connect();
  await pg.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await pg.end();

  execSync("npx prisma migrate deploy --config prisma7.config.ts", { stdio: "inherit", env: process.env });
  execSync("npx tsx --tsconfig scripts/tsconfig.scripts.json prisma/seed.ts --demo", { stdio: "inherit", env: process.env });

  const { db } = await import("../../src/server/validation/db");
  const client = await db.client.findFirstOrThrow();
  await db.workforceRequest.create({
    data: { clientId: client.id, role: "E2E Second Job", quantity: 2, duration: "1 month", siteLocation: "Huye", isPublished: true, status: "RECRUITING", jobDescription: "A second open post." },
  });
  await db.$disconnect();
  const outbox = process.env.MAIL_DEV_OUTBOX!;
  mkdirSync(dirname(outbox), { recursive: true });
  writeFileSync(outbox, "");
  console.log("e2e database ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
