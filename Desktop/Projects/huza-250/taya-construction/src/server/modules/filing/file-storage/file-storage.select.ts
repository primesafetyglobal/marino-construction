// FILE STORAGE SELECT: never selects secretAccessKey. accessKeyId is masked in the DTO.

import type { Prisma } from "@/server/validation/db";
import { canonicalBase } from "../lib/storage/urls";
import type { TestReport } from "../lib/storage/test";

export const storageSelect = {
  id: true,
  name: true,
  endpoint: true,
  region: true,
  bucket: true,
  prefix: true,
  forcePathStyle: true,
  accessKeyId: true,
  publicBaseUrl: true,
  access: true,
  isActive: true,
  isReadOnly: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { files: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.FileStorageSelect;

type Row = Prisma.FileStorageGetPayload<{ select: typeof storageSelect }>;

export type StorageDto = Omit<Row, "_count" | "accessKeyId"> & {
  accessKeyId: string; // masked
  canonicalBase: string;
  activeFiles: number;
  backups: number;
  migrationUnfinished: boolean;
  retentionEndsAt: Date | null; // read-only storages: updatedAt + 30 days
  lastTest: TestReport | null;
};

export const maskKey = (k: string) => (k.length <= 8 ? "••••" : `${k.slice(0, 4)}••••${k.slice(-4)}`);

export const RETENTION_DAYS = 30;

export function toStorageDto(r: Row, extra: { backups: number; lastTest: TestReport | null }): StorageDto {
  const { _count, accessKeyId, ...rest } = r;
  return {
    ...rest,
    accessKeyId: maskKey(accessKeyId),
    canonicalBase: canonicalBase(r),
    activeFiles: _count.files,
    backups: extra.backups,
    migrationUnfinished: r.isReadOnly && _count.files > 0,
    retentionEndsAt: r.isReadOnly ? new Date(r.updatedAt.getTime() + RETENTION_DAYS * 86_400_000) : null,
    lastTest: extra.lastTest,
  };
}
