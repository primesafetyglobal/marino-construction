// OPERATIONS DATES: calendar dates of requests. CLIENT-SAFE and pure.
// The locked schema stores them as DateTime; this module stores UTC midnight
// and sends "YYYY-MM-DD" out (DNSA ch. 18, 25).

import { OPS_CONFIG } from "./operations.config";

export type DateOnly = string;

export function today(now = new Date()): DateOnly {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OPS_CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const toDate = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
export const toDateOrNull = (d: DateOnly | null | undefined) => (d ? toDate(d) : null);
export const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

const DATE_ONLY_KEYS = new Set(["startDate", "endDate", "preferredDate", "deliveryDate", "deadline"]);
type DateOnlyKey = "startDate" | "endDate" | "preferredDate" | "deliveryDate" | "deadline";

export type OpsOut<T> = T extends Date
  ? T
  : T extends readonly (infer U)[]
    ? OpsOut<U>[]
    : T extends object
      ? {
          [K in keyof T]: K extends DateOnlyKey
            ? T[K] extends Date
              ? string
              : T[K] extends Date | null
                ? string | null
                : OpsOut<T[K]>
            : OpsOut<T[K]>;
        }
      : T;

export function toOpsOut<T>(value: T, key?: string): OpsOut<T> {
  if (value instanceof Date) return (key && DATE_ONLY_KEYS.has(key) ? toDateOnly(value) : value) as OpsOut<T>;
  if (value === null || typeof value !== "object") return value as OpsOut<T>;
  if (Array.isArray(value)) return value.map((v) => toOpsOut(v)) as OpsOut<T>;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toOpsOut(v, k)])) as OpsOut<T>;
}
