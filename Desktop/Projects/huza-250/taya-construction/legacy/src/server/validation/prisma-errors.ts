// Translates database errors into safe AppErrors.
//
// Why: raw Prisma messages reveal table names, columns and constraints.
// They must never reach the user. Known cases become clear messages,
// unknown ones return null and fall through to INTERNAL in errors.ts.
//
// Add a case here when a new Prisma error code shows up in the logs
// often enough to deserve its own message.

import { AppError, Errors } from "../core/errors";
import { Prisma } from "./db";

export function mapPrismaError(err: unknown): AppError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (err.code) {
    // Unique constraint failed, e.g. a role name that already exists.
    // meta.target lists the fields when the database driver provides them.
    case "P2002": {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.map(String) : [];
      return Errors.conflict(
        "A record with this value already exists.",
        Object.fromEntries(fields.map((f) => [f, ["Already in use."]])),
      );
    }

    // Record to update or delete does not exist (deleted by someone else).
    case "P2025":
      return Errors.notFound();

    // Foreign key failed: the record is still linked to other records,
    // or points to a record that does not exist.
    case "P2003":
      return Errors.conflict("This record is linked to other records.");

    // Two transactions touched the same rows at the same time.
    case "P2034":
      return Errors.conflict(
        "Another change happened at the same time. Please try again.",
      );

    default:
      return null;
  }
}
