// SERVICE SELECT: which fields may leave the server, and their types.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";
import type { ContentSection } from "./service.schema";

export const servicePublicSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  content: true,
  image: true,
  order: true,
  category: { select: { id: true, name: true, slug: true, division: true } },
} satisfies Prisma.ServiceSelect;

export const serviceAdminSelect = {
  ...servicePublicSelect,
  categoryId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { requests: true } },
} satisfies Prisma.ServiceSelect;

export const serviceRefSelect = { id: true, slug: true, name: true } satisfies Prisma.ServiceSelect;

type Row<S extends Prisma.ServiceSelect> = Prisma.ServiceGetPayload<{ select: S }>;
export type ServicePublic = Omit<Row<typeof servicePublicSelect>, "content"> & { content: ContentSection[] };
export type ServiceAdmin = Omit<Row<typeof serviceAdminSelect>, "content"> & { content: ContentSection[] };
export type ServiceRef = Row<typeof serviceRefSelect>;
export type ServiceList = ({ view: "public" } & Page<ServicePublic>) | ({ view: "admin" } & Page<ServiceAdmin>);
export type ServiceOne = ({ view: "public" } & ServicePublic) | ({ view: "admin" } & ServiceAdmin);
