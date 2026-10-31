// SUPPLY ORDER SELECT: staff only; public actions return only the code.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { OpsOut } from "../operations.dates";
import { clientCardSelect, clientNameSelect, userRefSelect, vendorCardSelect, type RequestCan } from "../operations.select";

export const supplyOrderListSelect = {
  id: true,
  number: true,
  items: true,
  status: true,
  source: true,
  deliveryLocation: true,
  deliveryDate: true,
  createdAt: true,
  client: { select: clientNameSelect },
  product: { select: { id: true, name: true, slug: true } },
  handledBy: { select: userRefSelect },
} satisfies Prisma.SupplyOrderSelect;

export const supplyOrderDetailSelect = {
  ...supplyOrderListSelect,
  quotedAmount: true,
  notes: true,
  updatedAt: true,
  client: { select: clientCardSelect },
  vendor: { select: vendorCardSelect },
} satisfies Prisma.SupplyOrderSelect;

export const supplyOrderRefSelect = { id: true, number: true, status: true } satisfies Prisma.SupplyOrderSelect;

type Row<S extends Prisma.SupplyOrderSelect> = Prisma.SupplyOrderGetPayload<{ select: S }>;
export type SupplyOrderListItem = OpsOut<Row<typeof supplyOrderListSelect>> & { code: string };
export type SupplyOrderDetail = OpsOut<Row<typeof supplyOrderDetailSelect>> & { code: string; can: RequestCan };
export type SupplyOrderRef = Row<typeof supplyOrderRefSelect> & { code: string };
export type SupplyOrderListPage = Page<SupplyOrderListItem>;
