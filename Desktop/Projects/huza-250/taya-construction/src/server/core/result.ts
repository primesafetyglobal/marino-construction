// The shape every action and every GET route returns.
// CLIENT-SAFE: type-only imports, no server code.
//
// Errors are returned, not thrown: a thrown error reaches the client as a
// generic failure and Error instances are not serializable. A plain object
// with a code lets the UI react: field errors, sign-in redirect, retry.

import type { AppError, ErrorCode, FieldErrors } from "./errors";

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  errorId?: string;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function toActionError(e: AppError): ActionError {
  return {
    code: e.code,
    message: e.message,
    fieldErrors: e.fieldErrors,
    errorId: e.errorId,
  };
}

// What a value looks like after JSON: Date becomes a string (it has toJSON).
// Server actions and Server Component props keep Date objects; GET routes do
// not. Type route data with this.
export type Jsonify<T> = T extends { toJSON(): infer R }
  ? R
  : T extends readonly (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

// What apiGet() returns for a route whose query returns T.
export type ApiResult<T> = ActionResult<Jsonify<T>>;

// Use when a client component receives initial data from a Server Component
// and later refetches through a route, so both have the same (JSON) shape.
export function jsonify<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value)) as Jsonify<T>;
}
