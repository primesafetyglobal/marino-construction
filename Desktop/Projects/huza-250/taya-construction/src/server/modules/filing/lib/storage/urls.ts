// URLS AND KEYS (guide §4.4): URL ↔ key is always derivable from the
// registered storages. File.url is computed, never stored on File.

import { getStorage, storages, type LoadedStorage } from "./registry";

type UrlStorage = Pick<LoadedStorage, "publicBaseUrl" | "endpoint" | "bucket" | "region" | "forcePathStyle" | "prefix">;

export const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const trim = (u: string) => u.replace(/\/+$/, "");

/** The one base used to build URLs for a storage. */
export function canonicalBase(s: UrlStorage): string {
  if (s.publicBaseUrl) return trim(s.publicBaseUrl);
  if (!s.endpoint) return `https://${s.bucket}.s3.${s.region}.amazonaws.com`;
  const ep = new URL(s.endpoint);
  return s.forcePathStyle ? `${trim(ep.origin)}/${s.bucket}` : `${ep.protocol}//${s.bucket}.${ep.host}`;
}

/** Every base a stored URL of this storage may use. */
export function baseVariants(s: UrlStorage): string[] {
  const v = new Set([canonicalBase(s)]);
  if (!s.endpoint) {
    v.add(`https://${s.bucket}.s3.${s.region}.amazonaws.com`);
    v.add(`https://${s.bucket}.s3.amazonaws.com`);
    v.add(`https://s3.${s.region}.amazonaws.com/${s.bucket}`);
    v.add(`https://${s.bucket}.s3-${s.region}.amazonaws.com`);
    v.add(`http://${s.bucket}.s3.${s.region}.amazonaws.com`);
  } else {
    const ep = new URL(s.endpoint);
    v.add(`${trim(ep.origin)}/${s.bucket}`);
    v.add(`${ep.protocol}//${s.bucket}.${ep.host}`);
  }
  return [...v];
}

export const buildUrl = (s: UrlStorage, key: string) => `${canonicalBase(s)}/${encodeKey(key)}`;

export const fileUrl = async (f: { storageId: string; key: string }) => buildUrl(await getStorage(f.storageId), f.key);

/** Drop query string and fragment (?v=2, leftover presign params, #...). */
export const cleanUrl = (url: string) => url.trim().replace(/[?#].*$/, "");

/** Any stored URL → { storage, key }, checking every registered storage and base variant. */
export async function parseUrl(url: string): Promise<{ storage: LoadedStorage; key: string } | null> {
  const clean = cleanUrl(url);
  for (const s of (await storages()).values()) {
    const found = parseWith(s, clean);
    if (found) return { storage: s, key: found };
  }
  return null;
}

export function parseWith(s: UrlStorage, cleanedUrl: string): string | null {
  for (const base of baseVariants(s)) {
    if (!cleanedUrl.startsWith(base + "/")) continue;
    try {
      const key = decodeURIComponent(cleanedUrl.slice(base.length + 1));
      if (key.startsWith(`${s.prefix}/`)) return key;
    } catch {
      return null;
    }
  }
  return null;
}

export const isOwnKey = (s: Pick<LoadedStorage, "prefix">, key: string) =>
  key.startsWith(`${s.prefix}/`) && !key.startsWith(`${s.prefix}/_backups/`) && !key.startsWith(`${s.prefix}/_system/`) && !key.endsWith("/");

/** Host names to allow in next/image for a storage. */
export const imageHost = (s: UrlStorage) => new URL(canonicalBase(s)).host;
