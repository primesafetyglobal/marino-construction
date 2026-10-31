// Prisma client singleton.
//
// No "server-only" here on purpose: seed and maintenance scripts import this
// file, and "server-only" crashes plain Node. Prisma cannot run in the
// browser anyway.
//
// Every file imports db, Prisma and DbClient from here, never from the
// generated path. If the generated client path changes, edit one line.
// ADJUST: the locked schema generates the client to prisma/src/generated/prisma
// (docs/DNSA.md, D-12).

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../../prisma/src/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // The adapter builds its pg pool from this config.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reused across hot reloads in dev so connections do not pile up.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export { Prisma };

// Either the client or a transaction client. Use as the type of the optional
// `client` parameter on service functions that may run inside a transaction.
export type DbClient = Prisma.TransactionClient;
