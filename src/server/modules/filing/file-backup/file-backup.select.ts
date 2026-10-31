// FILE BACKUP SELECT: totalSize is a BigInt in the database; DTOs carry a number.

import type { Prisma } from "@/server/validation/db";

export const backupSelect = {
  id: true,
  type: true,
  fromDate: true,
  toDate: true,
  fileCount: true,
  totalSize: true,
  status: true,
  archiveKey: true,
  error: true,
  createdBy: true,
  createdAt: true,
  completedAt: true,
  storageId: true,
} satisfies Prisma.FileBackupSelect;

type Row = Prisma.FileBackupGetPayload<{ select: typeof backupSelect }>;

export type BackupDto = Omit<Row, "totalSize" | "type"> & { totalSize: number; type: "FULL" | "INCREMENTAL" };

export const toBackupDto = (r: Row): BackupDto => ({ ...r, type: r.type === "INCREMENTAL" ? "INCREMENTAL" : "FULL", totalSize: Number(r.totalSize) });
