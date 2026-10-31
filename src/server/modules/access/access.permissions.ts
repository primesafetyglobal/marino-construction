// access.permissions.ts, no server-only, no path aliases: tests and a future
// sync script import it. D-3: mapped to roles in validation/auth.ts.
export const PERMISSIONS = [
  "user:invite", // invite staff users and resend invites (Admin+)
  "review:publish", // make a review public or private (Staff+)
  "auth-event:read", // read login and account history (Admin+)
] as const;
