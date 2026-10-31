// FILE SELECT: which fields may leave the server, and the DTO mapper that adds
// the computed `url` (never stored on File).

import type { Prisma } from "@/server/validation/db";
import { buildUrl } from "../lib/storage/urls";
import type { LoadedStorage } from "../lib/storage/registry";

export const fileSelect = {
  id: true,
  key: true,
  storageId: true,
  name: true,
  mimeType: true,
  size: true,
  folder: true,
  status: true,
  uploadedAt: true,
  deletedAt: true,
} satisfies Prisma.FileSelect;

export type FileRow = Prisma.FileGetPayload<{ select: typeof fileSelect }>;

export type FileDto = FileRow & { url: string; access: "PUBLIC" | "PRIVATE" };

type UrlStorage = Pick<LoadedStorage, "publicBaseUrl" | "endpoint" | "bucket" | "region" | "forcePathStyle" | "prefix" | "access">;

export const toFileDto = (f: FileRow, s: UrlStorage): FileDto => ({ ...f, url: buildUrl(s, f.key), access: s.access });
