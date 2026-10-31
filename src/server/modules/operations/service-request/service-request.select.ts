// SERVICE REQUEST SELECT: staff only; public actions return only the code.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { OpsOut } from "../operations.dates";
import { clientCardSelect, clientNameSelect, userRefSelect, vendorCardSelect, type RequestCan } from "../operations.select";

export const serviceRequestListSelect = {
  id: true,
  number: true,
  status: true,
  source: true,
  paymentPlan: true,
  siteLocation: true,
  preferredDate: true,
  createdAt: true,
  client: { select: clientNameSelect },
  service: { select: { id: true, name: true, slug: true, category: { select: { division: true } } } },
  handledBy: { select: userRefSelect },
} satisfies Prisma.ServiceRequestSelect;

export const serviceRequestDetailSelect = {
  ...serviceRequestListSelect,
  details: true,
  quotedAmount: true,
  deliveredAt: true,
  deliveryReport: true, // text, or a Filing file URL mapped to a link by the service
  notes: true,
  updatedAt: true,
  client: { select: clientCardSelect },
  vendor: { select: vendorCardSelect },
} satisfies Prisma.ServiceRequestSelect;

export const serviceRequestRefSelect = { id: true, number: true, status: true } satisfies Prisma.ServiceRequestSelect;

type Row<S extends Prisma.ServiceRequestSelect> = Prisma.ServiceRequestGetPayload<{ select: S }>;
export type ServiceRequestListItem = OpsOut<Row<typeof serviceRequestListSelect>> & { code: string };
export type ServiceRequestDetail = OpsOut<Omit<Row<typeof serviceRequestDetailSelect>, "deliveryReport">> & {
  code: string;
  deliveryReport: { text: string | null; fileLink: string | null; hasFile: boolean };
  can: RequestCan;
};
export type ServiceRequestRef = Row<typeof serviceRequestRefSelect> & { code: string };
export type ServiceRequestListPage = Page<ServiceRequestListItem>;
