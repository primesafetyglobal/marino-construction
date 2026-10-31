// PARTIES CODES: request codes shown next to payments. CLIENT-SAFE.
// The same format as operations.reference.ts; each module keeps its own copy (DNSA 9.3).

const PREFIX = { EQUIPMENT_REQUEST: "EQ", SUPPLY_ORDER: "SO", SERVICE_REQUEST: "SR" } as const;

export function requestCode(type: keyof typeof PREFIX, number: number): string {
  return `${PREFIX[type]}-${String(number).padStart(4, "0")}`;
}

export const REQUEST_PATH = {
  EQUIPMENT_REQUEST: "/admin/equipment-requests",
  SUPPLY_ORDER: "/admin/supply-orders",
  SERVICE_REQUEST: "/admin/service-requests",
} as const;
