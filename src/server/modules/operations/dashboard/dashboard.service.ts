// DASHBOARD SERVICE (flow): what needs attention today, across the four request
// types. Each part is a count or a bounded query; they run in parallel.

import "server-only";
import type { SessionUser } from "@/server/validation/auth";
import { db } from "@/server/validation/db";
import { REQUEST_ADMIN_PATH, requestCode, type RequestKind } from "../operations.reference";
import type { DashboardRequest, OperationsCounters, OperationsDashboard } from "./dashboard.select";

const OPEN = {
  EQUIPMENT_REQUEST: ["NEW", "QUOTED", "CONFIRMED", "ACTIVE"] as const,
  SUPPLY_ORDER: ["NEW", "QUOTED", "CONFIRMED"] as const,
  SERVICE_REQUEST: ["NEW", "QUOTED", "SCHEDULED", "IN_PROGRESS"] as const,
  WORKFORCE_REQUEST: ["NEW", "RECRUITING"] as const,
};

const base = { id: true, number: true, status: true, createdAt: true, client: { select: { name: true } }, handledBy: { select: { name: true } } } as const;

type BaseRow = { id: string; number: number; status: string; createdAt: Date; client: { name: string }; handledBy: { name: string } | null };

const toItem = (kind: RequestKind, title: (r: never) => string) => (r: BaseRow): DashboardRequest => ({
  kind,
  id: r.id,
  code: requestCode(kind, r.number),
  href: `${REQUEST_ADMIN_PATH[kind]}/${r.id}`,
  title: title(r as never),
  clientName: r.client.name,
  status: r.status,
  createdAt: r.createdAt,
  handlerName: r.handledBy?.name ?? null,
});

export async function countOperations(): Promise<OperationsCounters> {
  const [newEquipmentRequests, newSupplyOrders, newServiceRequests, newWorkforceRequests, activeRentals, newApplications] = await Promise.all([
    db.equipmentRequest.count({ where: { status: "NEW" } }),
    db.supplyOrder.count({ where: { status: "NEW" } }),
    db.serviceRequest.count({ where: { status: "NEW" } }),
    db.workforceRequest.count({ where: { status: "NEW" } }),
    db.equipmentRequest.count({ where: { status: "ACTIVE" } }),
    db.jobApplication.count({ where: { status: "NEW" } }),
  ]);
  return { newEquipmentRequests, newSupplyOrders, newServiceRequests, newWorkforceRequests, activeRentals, newApplications };
}

async function requests(take: number, mine: string | null): Promise<DashboardRequest[]> {
  const scope = <S extends readonly string[]>(open: S) => (mine ? { handledById: mine, status: { in: [...open] } } : {});
  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const [eq, so, sr, wr] = await Promise.all([
    db.equipmentRequest.findMany({ where: scope(OPEN.EQUIPMENT_REQUEST) as object, orderBy, take, select: { ...base, type: true, equipment: { select: { name: true } } } }),
    db.supplyOrder.findMany({ where: scope(OPEN.SUPPLY_ORDER) as object, orderBy, take, select: { ...base, items: true } }),
    db.serviceRequest.findMany({ where: scope(OPEN.SERVICE_REQUEST) as object, orderBy, take, select: { ...base, service: { select: { name: true } } } }),
    db.workforceRequest.findMany({ where: scope(OPEN.WORKFORCE_REQUEST) as object, orderBy, take, select: { ...base, role: true, quantity: true } }),
  ]);
  return [
    ...eq.map(toItem("EQUIPMENT_REQUEST", (r: (typeof eq)[number]) => `${r.type === "RENT" ? "Rent" : "Buy"} · ${r.equipment?.name ?? "Sourcing"}`)),
    ...so.map(toItem("SUPPLY_ORDER", (r: (typeof so)[number]) => r.items)),
    ...sr.map(toItem("SERVICE_REQUEST", (r: (typeof sr)[number]) => r.service.name)),
    ...wr.map(toItem("WORKFORCE_REQUEST", (r: (typeof wr)[number]) => `${r.quantity} × ${r.role}`)),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}

export async function getDashboard(ctx: { actor: SessionUser }): Promise<OperationsDashboard> {
  const [counters, myOpen, latest] = await Promise.all([countOperations(), requests(10, ctx.actor.id), requests(10, null)]);
  return { counters, myOpen, latest };
}
