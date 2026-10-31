// Browser helper for our GET routes. CLIENT-SAFE.
// Returns the same ActionResult shape as server actions, with JSON types.

import type { ActionError, ApiResult } from "@/server/core/result";

type ParamValue = string | number | boolean | null | undefined | readonly (string | number)[];

export function toSearch(params?: Record<string, ParamValue>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function apiGet<T>(
  path: `/api/${string}`,
  params?: Record<string, ParamValue>,
  init?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path + toSearch(params), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (err) {
    // Aborts are not failures: let the caller ignore them.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return failure("INTERNAL", "Network error. Check your connection and try again.");
  }
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    // A proxy error page or an empty body.
    return failure(res.status === 401 ? "UNAUTHENTICATED" : "INTERNAL", `Unexpected response (${res.status}).`);
  }
}

// For libraries that expect a throw on failure.
export class ApiError extends Error {
  constructor(readonly error: ActionError) {
    super(error.message);
    this.name = "ApiError";
  }
}

export function unwrap<T>(result: ApiResult<T>) {
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

function failure(code: ActionError["code"], message: string): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message } };
}
