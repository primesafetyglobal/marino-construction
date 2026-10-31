// Translates database errors into safe AppErrors. Single source of truth:
// errors.ts does not know about Prisma.
//
// Raw Prisma messages reveal tables, columns and constraints. They must
// never reach the user.

import { AppError, Errors, toAppError } from "../core/errors";
import { Prisma } from "./db";

export function mapPrismaError(err: unknown): AppError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (err.code) {
    // Unique constraint failed, e.g. a slug or phone that already exists.
    case "P2002": {
      const fields = uniqueFields(err.meta);
      return Errors.conflict(
        "A record with this value already exists.",
        Object.fromEntries(fields.map((f) => [f, ["Already in use."]])),
      );
    }
    // Record to update or delete does not exist.
    case "P2025":
      return Errors.notFound();
    // Foreign key failed: still linked, or points to a missing record.
    case "P2003":
      return Errors.conflict("This record is linked to other records.");
    // Two transactions touched the same rows at the same time.
    case "P2034":
      return Errors.conflict("Another change happened at the same time. Please try again.");
    default:
      return null;
  }
}

// The one function core files use to turn anything thrown into an AppError.
export function toSafeError(err: unknown): AppError {
  return toAppError(mapPrismaError(err) ?? err);
}

// meta.target is a field list with the classic engine. Driver adapters may
// report it differently. Verified by a unique-constraint test.
function uniqueFields(meta: Record<string, unknown> | undefined): string[] {
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  const fromAdapter = (meta as { driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } })
    ?.driverAdapterError?.cause?.constraint?.fields;
  // adapter-pg reads column names from the Postgres error detail, which quotes
  // mixed-case names: Key ("userId", "roleId").
  return Array.isArray(fromAdapter) ? fromAdapter.map((f) => String(f).replace(/^"(.*)"$/, "$1")) : [];
}
