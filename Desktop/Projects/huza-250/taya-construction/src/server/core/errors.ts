// One error type for the whole server layer.
//
// Leaf file: no project imports. Services, scripts and every core file can
// import it without import cycles. Prisma errors are mapped in
// validation/prisma-errors.ts, not here.
//
// Rule: services throw AppError for anything the user should know about.
// Anything else (bugs, database failures) becomes INTERNAL.

import { z } from "zod";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly errorId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fieldErrors?: FieldErrors; errorId?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.errorId = options?.errorId;
  }
}

// Use these instead of writing messages by hand, so wording stays consistent.
export const Errors = {
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Please sign in to continue."),

  forbidden: (message = "You do not have permission to do this.") =>
    new AppError("FORBIDDEN", message),

  notFound: (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`),

  conflict: (message: string, fieldErrors?: FieldErrors) =>
    new AppError("CONFLICT", message, { fieldErrors }),

  // Input failed the Zod schema.
  validation: (error: z.ZodError) =>
    new AppError("VALIDATION", "Please check the highlighted fields.", {
      fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
    }),

  // Input was well formed but breaks a data rule found by the service.
  invalid: (message: string, fieldErrors?: FieldErrors) =>
    new AppError("VALIDATION", message, { fieldErrors }),

  rateLimited: () =>
    new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again."),
};

// AppError passes through. Anything else is logged and hidden.
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const errorId = crypto.randomUUID();
  console.error(`[${errorId}]`, err);
  return new AppError("INTERNAL", `Something went wrong. Reference: ${errorId}`, {
    errorId,
    cause: err,
  });
}
