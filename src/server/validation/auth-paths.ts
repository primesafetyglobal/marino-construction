// Where pages send people who are signed out or not allowed.
//
// Leaf file (no imports), re-exported by auth.ts. config/authOptions.ts
// imports it from here: importing it from auth.ts would be a cycle.
export const AUTH_PATHS = {
  signIn: "/login",
  forbidden: "/forbidden",
} as const;
