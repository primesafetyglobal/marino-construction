// SEARCH SERVICE (flow): live suggestions across equipment, products, services
// and trainings, from public states and public fields only (CAT-R6, R9, R10, R11).
// Rate-limited: 120 per minute per hashed IP.

import "server-only";
import { db } from "@/server/validation/db";
import { checkRateLimit, PUBLIC_READ_LIMIT } from "@/server/validation/rate-limit";
import type { RequestMeta } from "@/server/validation/request";
import { CATALOG_CONFIG } from "../catalog.config";
import type { SearchCatalogData } from "./search.schema";
import type { SearchResult, SearchSuggestion } from "./search.select";

export async function searchCatalog(data: SearchCatalogData, meta: RequestMeta): Promise<SearchResult> {
  checkRateLimit({ scope: "catalog-search", ip: meta.ip, ...PUBLIC_READ_LIMIT });
  const q = data.q;
  if (q.length < 2) return { q, items: [] };
  const like = { contains: q, mode: "insensitive" as const };
  const take = data.limit;

  const [equipment, products, services, trainings] = await Promise.all([
    db.equipment.findMany({
      where: { status: { in: [...CATALOG_CONFIG.publicEquipmentStatuses] }, OR: [{ name: like }, { location: like }] },
      select: { id: true, slug: true, name: true, location: true },
      orderBy: [{ isFeatured: "desc" }, { id: "asc" }],
      take,
    }),
    db.product.findMany({
      where: { isAvailable: true, OR: [{ name: like }, { brand: like }] },
      select: { id: true, slug: true, name: true, category: { select: { name: true } } },
      orderBy: [{ isFeatured: "desc" }, { id: "asc" }],
      take,
    }),
    db.service.findMany({
      where: { isActive: true, OR: [{ name: like }, { summary: like }] },
      select: { id: true, slug: true, name: true, summary: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      take,
    }),
    db.training.findMany({
      where: { isPublished: true, OR: [{ title: like }, { summary: like }] },
      select: { id: true, title: true, type: true, externalUrl: true },
      orderBy: [{ isFeatured: "desc" }, { id: "asc" }],
      take,
    }),
  ]);

  const items: SearchSuggestion[] = [
    ...equipment.map((e) => ({ kind: "equipment" as const, id: e.id, title: e.name, subtitle: e.location, href: `/equipment/${e.slug}`, external: false })),
    ...products.map((p) => ({ kind: "product" as const, id: p.id, title: p.name, subtitle: p.category.name, href: `/materials/${p.slug}`, external: false })),
    ...services.map((s) => ({ kind: "service" as const, id: s.id, title: s.name, subtitle: s.summary, href: `/services/${s.slug}`, external: false })),
    ...trainings.map((t) => ({ kind: "training" as const, id: t.id, title: t.title, subtitle: `${t.type === "HSE" ? "HSE" : "Construction"} training`, href: t.externalUrl, external: true })),
  ];
  return { q, items };
}
