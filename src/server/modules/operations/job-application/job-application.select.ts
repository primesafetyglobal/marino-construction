// JOB APPLICATION SELECT: admin only; includes the applicant's name, contact,
// trade and a CV link (never the storage key).

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

// D-1: applicant (parties) and workforce request through the locked schema's relations.
export const applicationSelect = {
  id: true,
  status: true,
  message: true,
  notes: true,
  createdAt: true,
  applicant: { select: { id: true, fullName: true, phone: true, email: true, trade: true, district: true, cvUrl: true } },
  workforceRequest: { select: { id: true, number: true, role: true } },
} satisfies Prisma.JobApplicationSelect;

export const applicationRefSelect = { id: true, status: true } satisfies Prisma.JobApplicationSelect;

type Row = Prisma.JobApplicationGetPayload<{ select: typeof applicationSelect }>;
export type ApplicationItem = Omit<Row, "applicant"> & {
  applicant: Omit<Row["applicant"], "cvUrl"> & { hasCv: boolean; cvLink: string | null };
  code: string;
};
export type ApplicationRef = Prisma.JobApplicationGetPayload<{ select: typeof applicationRefSelect }>;
export type ApplicationListPage = Page<ApplicationItem>;
