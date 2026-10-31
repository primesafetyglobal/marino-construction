// Shared helpers of the jobs.

import { references, type FileReference } from "../references/registry";
import { storages, type LoadedStorage } from "../storage/registry";
import { baseVariants } from "../storage/urls";

/** Every base variant of every registered storage (longest first). */
export async function allBases(only?: LoadedStorage[]): Promise<string[]> {
  const list = only ?? [...(await storages()).values()];
  return [...new Set(list.flatMap(baseVariants))].sort((a, b) => b.length - a.length);
}

export function refOf(table: string, column: string): FileReference {
  const r = references().find((x) => x.table === table && x.column === column);
  if (!r) throw new Error(`Undeclared reference ${table}.${column}`);
  return r;
}

export type RefItem = { table: string; column: string; pk: string; value: string };

export const cap = <T>(list: T[], n = 1000) => list.slice(0, n);
