// OPERATIONS REFERENCE: request codes (OPS-R1). CLIENT-SAFE and pure.

export const CODE_PREFIX = {
  EQUIPMENT_REQUEST: "EQ",
  SUPPLY_ORDER: "SO",
  SERVICE_REQUEST: "SR",
  WORKFORCE_REQUEST: "WR",
} as const;

export type RequestKind = keyof typeof CODE_PREFIX;

// 42 → "SR-0042"; numbers above 9999 keep all their digits.
export function requestCode(kind: RequestKind, number: number): string {
  return `${CODE_PREFIX[kind]}-${String(number).padStart(4, "0")}`;
}

// "sr-0042" → { kind: "SERVICE_REQUEST", number: 42 }
export function parseCode(code: string): { kind: RequestKind; number: number } | null {
  const m = code.trim().toUpperCase().match(/^(EQ|SO|SR|WR)-?(\d{1,9})$/);
  if (!m) return null;
  const kind = (Object.keys(CODE_PREFIX) as RequestKind[]).find((k) => CODE_PREFIX[k] === m[1])!;
  return { kind, number: Number(m[2]) };
}

// A believable code for the honeypot reply (OPS-R16); nothing is saved.
export function fakeCode(kind: RequestKind): string {
  return requestCode(kind, 1000 + Math.floor(Math.random() * 8999));
}

export const REQUEST_ADMIN_PATH: Record<RequestKind, string> = {
  EQUIPMENT_REQUEST: "/admin/equipment-requests",
  SUPPLY_ORDER: "/admin/supply-orders",
  SERVICE_REQUEST: "/admin/service-requests",
  WORKFORCE_REQUEST: "/admin/workforce-requests",
};
