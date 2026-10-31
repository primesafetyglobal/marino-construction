// REFERENCES REGISTRY (guide §7.1): the app-level list of database columns
// that hold file URLs, loaded from src/config/file-references.ts.
// Identifiers are validated before they ever reach SQL.

import { fileReferences } from "@/config/file-references";

export type ReferenceType = "url" | "url[]" | "text" | "json";

export type FileReference = {
  table: string; // database table name
  column: string; // database column name
  type: ReferenceType;
  pk: string; // database primary-key column (text or uuid)
  folder?: string;
  label: string;
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateReference(r: FileReference): FileReference {
  for (const id of [r.table, r.column, r.pk]) if (!IDENT.test(id)) throw new Error(`Invalid identifier in file references: ${id}`);
  if (!["url", "url[]", "text", "json"].includes(r.type)) throw new Error(`Invalid reference type: ${r.type}`);
  return r;
}

export const q = (ident: string) => {
  if (!IDENT.test(ident)) throw new Error(`Invalid identifier: ${ident}`);
  return `"${ident}"`;
};

let loaded: FileReference[] | null = null;
export function references(): FileReference[] {
  loaded ??= fileReferences.map(validateReference);
  return loaded;
}

/** Tests only. */
export function setReferences(list: FileReference[] | null) {
  loaded = list ? list.map(validateReference) : null;
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
export const escapeSlashes = (s: string) => s.replace(/\//g, "\\/");
