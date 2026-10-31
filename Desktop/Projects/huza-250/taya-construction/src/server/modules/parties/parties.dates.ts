// PARTIES DATES: calendar dates (dueDate, dateOfBirth). CLIENT-SAFE and pure.
// A calendar date is "YYYY-MM-DD" outside the database; arithmetic is UTC;
// "today" is read in the business time zone (DNSA ch. 18).

import { PARTIES_CONFIG } from "./parties.config";

export type DateOnly = string; // "2026-10-05"

export function today(now = new Date()): DateOnly {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARTIES_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const toDate = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`); // for Prisma
export const toDateOnly = (d: Date) => d.toISOString().slice(0, 10); // from Prisma

// Whole years between a birth date and a day (PTY-R8).
export function ageOn(birth: DateOnly, day: DateOnly): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// The birth date of someone who turns `age` on `day`.
export function birthDateForAge(age: number, day: DateOnly): DateOnly {
  const [y, m, d] = day.split("-");
  return `${String(Number(y) - age).padStart(4, "0")}-${m}-${d === "29" && m === "02" ? "28" : d}`;
}

// ---------- Output (DNSA ch. 25) ----------

const DATE_ONLY_KEYS = new Set(["dueDate", "dateOfBirth"]);
type DateOnlyKey = "dueDate" | "dateOfBirth";

export type PartiesOut<T> = T extends Date
  ? T
  : T extends readonly (infer U)[]
    ? PartiesOut<U>[]
    : T extends object
      ? {
          [K in keyof T]: K extends DateOnlyKey
            ? T[K] extends Date
              ? string
              : T[K] extends Date | null
                ? string | null
                : PartiesOut<T[K]>
            : PartiesOut<T[K]>;
        }
      : T;

export function toPartiesOut<T>(value: T, key?: string): PartiesOut<T> {
  if (value instanceof Date) {
    return (key && DATE_ONLY_KEYS.has(key) ? toDateOnly(value) : value) as PartiesOut<T>;
  }
  if (value === null || typeof value !== "object") return value as PartiesOut<T>;
  if (Array.isArray(value)) return value.map((v) => toPartiesOut(v)) as PartiesOut<T>;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPartiesOut(v, k)])) as PartiesOut<T>;
}
