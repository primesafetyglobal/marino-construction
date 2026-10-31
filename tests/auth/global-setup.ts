// Runs once before the database tests: creates the test database if needed,
// wipes it, and applies every migration with `prisma migrate deploy`.

import { execSync } from "node:child_process";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
  const testUrl = project.config.env.DATABASE_URL;
  if (!testUrl) throw new Error("vitest.config.mts did not set DATABASE_URL for the db project.");
  const url = new URL(testUrl);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const server = new Client({ connectionString: admin.toString() });
  await server.connect();
  const { rowCount } = await server.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!rowCount) await server.query(`CREATE DATABASE "${name}"`);
  await server.end();

  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await db.end();

  execSync("npx prisma migrate deploy --config prisma7.config.ts", { stdio: "ignore", env: { ...process.env, DATABASE_URL: url.toString() } });
}
