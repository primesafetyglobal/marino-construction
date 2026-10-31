// FILING ERRORS: the guide's error codes (§17) on top of the core AppError.
// The core keeps its seven codes; each filing code maps onto one of them and
// travels in `filingCode` so the UI and tests can tell them apart.
// No "server-only": tests and scripts import it.

import { AppError, type ErrorCode } from "@/server/core/errors";

export type FilingCode =
  | "FILE_TYPE_NOT_ALLOWED"
  | "FILE_TOO_LARGE"
  | "FILE_CONTENT_MISMATCH"
  | "FILE_KEY_INVALID"
  | "FILE_NOT_IN_STORAGE"
  | "FILE_NOT_FOUND"
  | "FILE_MOVE_NOT_ALLOWED"
  | "STORAGE_NOT_CONFIGURED"
  | "STORAGE_NOT_FOUND"
  | "STORAGE_READ_ONLY"
  | "STORAGE_TEST_FAILED"
  | "STORAGE_LOCKED_FIELDS"
  | "STORAGE_IN_USE"
  | "STORAGE_ACCESS_MISMATCH"
  | "STORAGE_ERROR"
  | "FILING_JOB_IN_PROGRESS"
  | "MIGRATION_PRECHECK_FAILED"
  | "MIGRATION_NOT_FINISHED"
  | "BACKUP_NOT_READY"
  | "ENCRYPTION_KEY_INVALID";

const CORE: Record<FilingCode, ErrorCode> = {
  FILE_TYPE_NOT_ALLOWED: "VALIDATION",
  FILE_TOO_LARGE: "VALIDATION",
  FILE_CONTENT_MISMATCH: "VALIDATION",
  FILE_KEY_INVALID: "VALIDATION",
  FILE_NOT_IN_STORAGE: "VALIDATION",
  FILE_NOT_FOUND: "NOT_FOUND",
  FILE_MOVE_NOT_ALLOWED: "CONFLICT",
  STORAGE_NOT_CONFIGURED: "CONFLICT",
  STORAGE_NOT_FOUND: "NOT_FOUND",
  STORAGE_READ_ONLY: "CONFLICT",
  STORAGE_TEST_FAILED: "VALIDATION",
  STORAGE_LOCKED_FIELDS: "CONFLICT",
  STORAGE_IN_USE: "CONFLICT",
  STORAGE_ACCESS_MISMATCH: "CONFLICT",
  STORAGE_ERROR: "INTERNAL",
  FILING_JOB_IN_PROGRESS: "CONFLICT",
  MIGRATION_PRECHECK_FAILED: "CONFLICT",
  MIGRATION_NOT_FINISHED: "CONFLICT",
  BACKUP_NOT_READY: "CONFLICT",
  ENCRYPTION_KEY_INVALID: "INTERNAL",
};

export class FilingError extends AppError {
  readonly filingCode: FilingCode;
  constructor(code: FilingCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(CORE[code], message, { fieldErrors });
    this.name = "FilingError";
    this.filingCode = code;
  }
}

export const isFilingError = (e: unknown, code?: FilingCode): e is FilingError =>
  e instanceof FilingError && (!code || e.filingCode === code);
