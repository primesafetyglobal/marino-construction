// PARTIES CONFIG: per-product settings and page paths. CLIENT-SAFE: forms import this file.

export const PARTIES_CONFIG = {
  timeZone: "Africa/Kigali",
  minApplicantAge: 18,
  installments: { min: 2, max: 24 },
  files: {
    cv: { maxSizeBytes: 5 * 1024 * 1024, allowedMimeTypes: ["application/pdf"] },
    logo: { maxSizeBytes: 4 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
    urlTtlSeconds: 300,
  },
} as const;

export const PARTIES_PATHS = {
  clients: "/admin/clients",
  vendors: "/admin/vendors",
  applicants: "/admin/applicants",
  payments: "/admin/payments",
  home: "/",
} as const;
