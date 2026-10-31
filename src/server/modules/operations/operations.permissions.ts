// operations.permissions.ts, no server-only, no path aliases: tests and a
// future sync script import it. D-3: mapped to roles in validation/auth.ts.
export const PERMISSIONS = [
  "workforce-request:publish", // publish / unpublish a workforce request as a job post
] as const;
