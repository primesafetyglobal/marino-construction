// CATALOG CONFIG: per-product settings and page paths. CLIENT-SAFE: forms import this file.

export const CATALOG_CONFIG = {
  limits: { imagesPerItem: 10, specsRows: 20, contentSections: 10, featured: 12, searchPerGroup: 6 },
  files: {
    // Image uploads (equipment, products, services, trainings, categories).
    image: { maxSizeBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
    urlTtlSeconds: 300,
  },
  // Paint products are the products of this category (also shown on Paint Rwanda).
  paintCategorySlug: "paints-finishes",
  // Equipment statuses that visitors may see (CAT-R6).
  publicEquipmentStatuses: ["AVAILABLE", "RENTED"],
} as const;

// Pages refreshed after catalog writes.
export const CATALOG_PATHS = {
  public: "/",
  admin: "/admin/catalog",
} as const;
