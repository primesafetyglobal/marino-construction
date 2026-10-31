// WORKFORCE REQUEST SELECT: staff selects, and the public "job post" select
// written from scratch: no client, no notes, no handler (OPS-R11).

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { OpsOut } from "../operations.dates";
import { clientCardSelect, clientNameSelect, userRefSelect, type RequestCan } from "../operations.select";

export const jobPublicSelect = {
  id: true,
  number: true,
  role: true,
  quantity: true,
  duration: true,
  siteLocation: true, // reduced to the district by the service
  startDate: true,
  jobDescription: true,
  deadline: true,
} satisfies Prisma.WorkforceRequestSelect;

export const workforceRequestListSelect = {
  id: true,
  number: true,
  role: true,
  quantity: true,
  duration: true,
  siteLocation: true,
  startDate: true,
  status: true,
  source: true,
  isPublished: true,
  deadline: true,
  createdAt: true,
  client: { select: clientNameSelect },
  handledBy: { select: userRefSelect },
  _count: { select: { applications: true } },
} satisfies Prisma.WorkforceRequestSelect;

export const workforceRequestDetailSelect = {
  ...workforceRequestListSelect,
  details: true,
  jobDescription: true,
  notes: true,
  updatedAt: true,
  client: { select: clientCardSelect },
} satisfies Prisma.WorkforceRequestSelect;

export const workforceRequestRefSelect = { id: true, number: true, status: true, isPublished: true } satisfies Prisma.WorkforceRequestSelect;

type Row<S extends Prisma.WorkforceRequestSelect> = Prisma.WorkforceRequestGetPayload<{ select: S }>;

export type JobPost = {
  number: number;
  code: string;
  role: string;
  quantity: number;
  duration: string;
  district: string;
  startDate: string | null;
  jobDescription: string | null;
  deadline: string | null;
};
export type JobPage = Page<JobPost & { id: string }>;

export type WorkforceRequestListItem = OpsOut<Row<typeof workforceRequestListSelect>> & { code: string; isOpen: boolean };
export type WorkforceRequestDetail = OpsOut<Row<typeof workforceRequestDetailSelect>> & {
  code: string;
  isOpen: boolean;
  can: RequestCan & { publish: boolean };
};
export type WorkforceRequestRef = Row<typeof workforceRequestRefSelect> & { code: string };
export type WorkforceRequestListPage = Page<WorkforceRequestListItem>;
