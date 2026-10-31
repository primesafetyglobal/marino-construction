// FOLDERS: virtual folders on File.folder (guide §4.7). CLIENT-SAFE and pure.

export type FolderRule = { mimeTypes?: string[]; maxMb?: number; access?: "PUBLIC" | "PRIVATE" };
export type FolderRules = Record<string, FolderRule>;

export const FOLDER_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,4}$/;

export const normalizeFolder = (f?: string | null): string | null => {
  const n = (f ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  return n || null;
};

/** The rule of a folder, inherited from the nearest parent that has one. */
export function ruleFor(folder: string | null, rules: FolderRules | null | undefined): FolderRule | null {
  if (!folder || !rules) return null;
  const parts = folder.split("/");
  for (let i = parts.length; i > 0; i--) {
    const r = rules[parts.slice(0, i).join("/")];
    if (r) return r;
  }
  return null;
}

export const UNFILED = "__unfiled";
