"use client";
// Form helpers for client components. CLIENT-SAFE.
// Every form validates with the same Zod schema as the server first (for
// instant feedback), then calls the action, and shows field errors from either.

import { useCallback, useState } from "react";
import type { z } from "zod";
import type { ActionError, ActionResult } from "@/server/core/result";

export type FieldErrors = Record<string, string[] | undefined>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function useActionForm<T>() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<ActionError | null>(null);

  const run = useCallback(
    // Form state holds strings; the schema (client side, then server side) turns them into typed input.
    async (opts: { schema?: z.ZodType; input: unknown; action: (input: never) => Promise<ActionResult<T>> }): Promise<T | null> => {
      setErrors({});
      setFormError(null);
      if (opts.schema) {
        const check = opts.schema.safeParse(opts.input);
        if (!check.success) {
          setErrors(zodFieldErrors(check.error));
          return null;
        }
      }
      setPending(true);
      try {
        const result = await opts.action(opts.input as never);
        if (!result.ok) {
          if (result.error.fieldErrors && Object.keys(result.error.fieldErrors).length) setErrors(result.error.fieldErrors);
          setFormError(result.error);
          return null;
        }
        return result.data;
      } catch {
        setFormError({ code: "INTERNAL", message: "Network error. Check your connection and try again." });
        return null;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { pending, errors, formError, setErrors, setFormError, run };
}

// Reads the values of a <form> into a plain object (strings, and booleans for checkboxes).
export function formValues(form: HTMLFormElement): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "radio") {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  }
  return out;
}
