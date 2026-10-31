// SERVICE SERVICE: services of Inspection & Testing, Waste Management,
// Engineering & Construction, Paint Rwanda and Equipment Services.
//
// Rules:
// - CAT-R1  slug unique
// - CAT-R4  the category must be a SERVICE category; the division comes from it
// - CAT-R10 content: at most 10 sections of the four shapes; only active
//           services are public; a service with requests cannot be deleted

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { resolveImage } from "../catalog.files";
import { uniqueSlug } from "../catalog.slug";
import { assertCategoryType } from "../category/category.service";
import {
  contentSchema,
  type ContentSection,
  type CreateServiceData,
  type ListServicesData,
  type ServiceIdData,
  type UpdateServiceData,
} from "./service.schema";
import {
  serviceAdminSelect,
  servicePublicSelect,
  serviceRefSelect,
  type ServiceAdmin,
  type ServiceList,
  type ServiceOne,
  type ServicePublic,
  type ServiceRef,
} from "./service.select";

type Actor = { actor: SessionUser | null };
type Division = ServicePublic["category"]["division"];

// CAT-R10: the one definition of "public service".
const publicWhere = { isActive: true } satisfies Prisma.ServiceWhereInput;
const ORDER = [{ order: "asc" as const }, { name: "asc" as const }, { id: "asc" as const }];

const readContent = (value: unknown): ContentSection[] => {
  const parsed = contentSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

// Public results are built field by field.
const toPublic = (row: Prisma.ServiceGetPayload<{ select: typeof servicePublicSelect }>): ServicePublic => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  summary: row.summary,
  description: row.description,
  content: readContent(row.content),
  image: row.image,
  order: row.order,
  category: { id: row.category.id, name: row.category.name, slug: row.category.slug, division: row.category.division },
});
const toAdmin = (row: Prisma.ServiceGetPayload<{ select: typeof serviceAdminSelect }>): ServiceAdmin => ({
  ...row,
  content: readContent(row.content),
});

function filters(query: ListServicesData, staff: boolean): Prisma.ServiceWhereInput {
  const and: Prisma.ServiceWhereInput[] = [];
  if (!staff) and.push(publicWhere);
  else if (query.active !== undefined) and.push({ isActive: query.active });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { summary: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.division) and.push({ category: { is: { division: query.division } } });
  if (query.categoryId) and.push({ categoryId: query.categoryId });
  return and.length ? { AND: and } : {};
}

// ======================= Reads =======================

export async function listServices(query: ListServicesData, ctx: Actor): Promise<ServiceList> {
  if (hasPermission(ctx.actor, "service:read") && query.view !== "public") return { view: "admin", ...(await listServicesAdmin(query)) };
  const rows = await db.service.findMany({ where: filters(query, false), orderBy: ORDER, select: servicePublicSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  return { view: "public", items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

export async function listServicesAdmin(query: ListServicesData) {
  const rows = await db.service.findMany({ where: filters(query, true), orderBy: ORDER, select: serviceAdminSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  return { items: page.items.map(toAdmin), nextCursor: page.nextCursor };
}

export async function getServiceDetail(id: string, ctx: Actor): Promise<ServiceOne | null> {
  if (hasPermission(ctx.actor, "service:read")) {
    const row = await db.service.findUnique({ where: { id }, select: serviceAdminSelect });
    return row ? { view: "admin", ...toAdmin(row) } : null;
  }
  const row = await db.service.findFirst({ where: { id, ...publicWhere }, select: servicePublicSelect });
  return row ? { view: "public", ...toPublic(row) } : null;
}

export async function getServiceAdmin(id: string): Promise<ServiceAdmin | null> {
  const row = await db.service.findUnique({ where: { id }, select: serviceAdminSelect });
  return row ? toAdmin(row) : null;
}

export async function getServiceBySlug(slug: string): Promise<ServicePublic | null> {
  const row = await db.service.findFirst({ where: { slug, ...publicWhere }, select: servicePublicSelect });
  return row ? toPublic(row) : null;
}

export async function listServicesByDivision(division: Division): Promise<ServicePublic[]> {
  const rows = await db.service.findMany({
    where: { ...publicWhere, category: { is: { division } } },
    orderBy: ORDER,
    select: servicePublicSelect,
    take: 100,
  });
  return rows.map(toPublic);
}

// No isFeatured column (module record, Decisions): the first active services of a division by order.
export async function listFeaturedServices(division: Division, limit: number): Promise<ServicePublic[]> {
  const rows = await db.service.findMany({
    where: { ...publicWhere, category: { is: { division } } },
    orderBy: ORDER,
    select: servicePublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

// ======================= Writes =======================

// CAT-R1, R4, R10.
export async function createService(data: CreateServiceData): Promise<ServiceRef> {
  const image = data.image ? await resolveImage(data.image, "service", true) : null;
  return db.$transaction(async (tx) => {
    await assertCategoryType(data.categoryId, "SERVICE", tx);
    const slug = await uniqueSlug("service", { wanted: data.slug, from: data.name }, tx);
    return tx.service.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug,
        summary: data.summary,
        description: data.description,
        content: data.content,
        image,
        order: data.order,
        isActive: data.isActive,
      },
      select: serviceRefSelect,
    });
  });
}

// CAT-R1, R4, R10.
export async function updateService(data: UpdateServiceData): Promise<ServiceRef> {
  const image = data.image ? await resolveImage(data.image, "service", true) : data.image;
  return db.$transaction(async (tx) => {
    const current = await tx.service.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!current) throw Errors.notFound("Service");
    if (data.categoryId) await assertCategoryType(data.categoryId, "SERVICE", tx);
    const slug = data.slug ? await uniqueSlug("service", { wanted: data.slug, from: data.slug, exceptId: data.id }, tx) : undefined;
    return tx.service.update({
      where: { id: data.id },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug,
        summary: data.summary,
        description: data.description,
        content: data.content,
        image,
        order: data.order,
        isActive: data.isActive,
      },
      select: serviceRefSelect,
    });
  });
}

// CAT-R10.
export async function deleteService({ id }: ServiceIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.service.findUnique({ where: { id }, select: { _count: { select: { requests: true } } } });
    if (!current) throw Errors.notFound("Service");
    if (current._count.requests > 0) throw Errors.conflict("This service has requests. Make it inactive instead.");
    await tx.service.delete({ where: { id } });
    return { id };
  });
}

// ======================= Shared with other modules (D-2) =======================

// Operations: a requested service must exist; public requests need an active one (OPS-R10).
export async function assertPublicService(id: string, opts: { publicOnly: boolean }, client: DbClient) {
  const row = await client.service.findFirst({
    where: { id, ...(opts.publicOnly ? publicWhere : {}) },
    select: { id: true, name: true, category: { select: { division: true } } },
  });
  if (!row) throw Errors.invalid("This service is not available.", { serviceId: ["Not available."] });
  return { id: row.id, name: row.name, division: row.category.division };
}
