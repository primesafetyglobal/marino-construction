// FILE REFERENCES: every database column that stores file URLs (Filing guide §7).
// Database table / column names. Add a new column here in the same change that
// starts storing file URLs in it. Discovery (Health → Discovery) finds misses.

import type { FileReference } from "@/server/modules/filing/lib/references/registry";

export const fileReferences: FileReference[] = [
  { table: "Equipment", column: "images", type: "url[]", pk: "id", folder: "equipment", label: "Equipment photos" },
  { table: "Product", column: "images", type: "url[]", pk: "id", folder: "products", label: "Product photos" },
  { table: "Category", column: "image", type: "url", pk: "id", folder: "categories", label: "Category image" },
  { table: "Service", column: "image", type: "url", pk: "id", folder: "services", label: "Service image" },
  { table: "Training", column: "image", type: "url", pk: "id", folder: "trainings", label: "Training image" },
  { table: "Vendor", column: "logo", type: "url", pk: "id", folder: "vendor-logos", label: "Vendor logo" },
  { table: "Applicant", column: "cvUrl", type: "url", pk: "id", folder: "cvs", label: "Applicant CV" },
  { table: "ServiceRequest", column: "deliveryReport", type: "text", pk: "id", folder: "delivery-reports", label: "Delivery report" },
];
