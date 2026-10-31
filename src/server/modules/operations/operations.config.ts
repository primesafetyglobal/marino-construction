// OPERATIONS CONFIG: per-product settings and page paths. CLIENT-SAFE: forms import this file.

export const OPS_CONFIG = {
  timeZone: "Africa/Kigali",
  files: {
    report: { maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] },
    urlTtlSeconds: 300,
  },
  openJobsLimit: 50,
} as const;

export const OPS_PATHS = {
  equipmentRequests: "/admin/equipment-requests",
  supplyOrders: "/admin/supply-orders",
  serviceRequests: "/admin/service-requests",
  workforceRequests: "/admin/workforce-requests",
  jobs: "/jobs",
  dashboard: "/admin",
} as const;
