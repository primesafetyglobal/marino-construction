// catalog.permissions.ts, no server-only, no path aliases: tests and a future
// sync script import it. Keys that are not the generated read / create /
// update / delete of a model (D-3: mapped to roles in validation/auth.ts).
export const PERMISSIONS = [
  "equipment:approve", // approve and publish a PENDING equipment submission
] as const;
