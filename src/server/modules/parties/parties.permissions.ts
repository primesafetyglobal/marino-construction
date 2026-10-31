// parties.permissions.ts, no server-only, no path aliases: tests and a future
// sync script import it. D-3: mapped to roles in validation/auth.ts.
export const PERMISSIONS = [
  "vendor:partner", // mark or unmark an approved vendor as Marino partner (Admin+)
  "payment:record", // record payments, create installment plans, mark paid
] as const;
