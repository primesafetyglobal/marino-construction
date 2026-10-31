// ACCESS CONFIG: per-product settings and page paths. CLIENT-SAFE: forms import this file.

export const ACCESS_CONFIG = {
  passwords: { min: 10, max: 200, bcryptCost: 12 },
  tokens: {
    INVITE: 7 * 24 * 60 * 60 * 1000, // 7 days
    PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
    EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24 hours
  },
  // ACC-R7: counted from AuthEvent.
  limits: {
    loginPerEmail: { max: 5, windowMs: 15 * 60 * 1000 },
    loginPerIp: { max: 20, windowMs: 15 * 60 * 1000 },
    resetPerEmail: { max: 3, windowMs: 60 * 60 * 1000 },
    resetPerIp: { max: 10, windowMs: 60 * 60 * 1000 },
  },
  activityLimit: 20,
  cleanup: { tokensOlderThanDays: 30, eventsOlderThanMonths: 12, batch: 10_000 },
} as const;

export const ACCESS_PATHS = {
  users: "/admin/users",
  account: "/admin/account",
  reviews: "/admin/reviews",
  publicReviews: "/reviews",
  home: "/",
  invite: (token: string) => `/invite/${token}`,
  reset: (token: string) => `/reset-password/${token}`,
  verifyEmail: (token: string) => `/verify-email/${token}`,
} as const;
