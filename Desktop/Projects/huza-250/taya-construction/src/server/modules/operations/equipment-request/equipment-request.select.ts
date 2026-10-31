// EQUIPMENT REQUEST SELECT: staff only; public actions return only the code.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { OpsOut } from "../operations.dates";
import { clientCardSelect, clientNameSelect, userRefSelect, type RequestCan } from "../operations.select";

export const equipmentRequestListSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  source: true,
  siteLocation: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  client: { select: clientNameSelect },
  equipment: { select: { id: true, name: true, slug: true } },
  handledBy: { select: userRefSelect },
} satisfies Prisma.EquipmentRequestSelect;

export const equipmentRequestDetailSelect = {
  ...equipmentRequestListSelect,
  details: true,
  quotedAmount: true,
  notes: true,
  updatedAt: true,
  client: { select: clientCardSelect },
  equipment: { select: { id: true, name: true, slug: true, status: true, forRent: true, forSale: true } },
} satisfies Prisma.EquipmentRequestSelect;

export const equipmentRequestRefSelect = { id: true, number: true, status: true } satisfies Prisma.EquipmentRequestSelect;

type Row<S extends Prisma.EquipmentRequestSelect> = Prisma.EquipmentRequestGetPayload<{ select: S }>;
export type EquipmentRequestListItem = OpsOut<Row<typeof equipmentRequestListSelect>> & { code: string };
export type EquipmentRequestDetail = OpsOut<Row<typeof equipmentRequestDetailSelect>> & { code: string; can: RequestCan };
export type EquipmentRequestRef = Row<typeof equipmentRequestRefSelect> & { code: string };
export type EquipmentRequestListPage = Page<EquipmentRequestListItem>;
