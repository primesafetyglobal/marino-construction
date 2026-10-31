// DASHBOARD SELECT (flow): the shape of the operations part of /admin, declared by hand.

import type { RequestKind } from "../operations.reference";

export type DashboardRequest = {
  kind: RequestKind;
  id: string;
  code: string;
  href: string;
  title: string;
  clientName: string;
  status: string;
  createdAt: Date;
  handlerName: string | null;
};

export type OperationsCounters = {
  newEquipmentRequests: number;
  newSupplyOrders: number;
  newServiceRequests: number;
  newWorkforceRequests: number;
  activeRentals: number;
  newApplications: number;
};

export type OperationsDashboard = {
  counters: OperationsCounters;
  myOpen: DashboardRequest[];
  latest: DashboardRequest[];
};
