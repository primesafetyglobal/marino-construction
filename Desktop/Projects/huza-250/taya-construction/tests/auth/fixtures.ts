// Fixtures: write straight to the database to set up state. The code under
// test always goes through actions, queries, routes and services.

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { db } from "@/server/validation/db";
import { toSafeError } from "@/server/validation/prisma-errors";
import { harness } from "./harness";

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF";
export type TestUser = { id: string; email: string; name: string; role: Role };

// Empties every table.
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

const HASH = bcrypt.hashSync("correct horse battery", 4);
export const PASSWORD = "correct horse battery";

export async function makeUser(opts: { role?: Role; active?: boolean; email?: string; invitePending?: boolean } = {}): Promise<TestUser> {
  return db.user.create({
    data: {
      name: `Test ${opts.role ?? "STAFF"}`,
      email: opts.email ?? `u-${randomUUID().slice(0, 8)}@example.test`,
      password: opts.invitePending ? "" : HASH,
      role: opts.role ?? "STAFF",
      isActive: opts.active ?? true,
      mustChangePassword: false,
    },
    select: { id: true, email: true, name: true, role: true },
  });
}

export function signInAs(user: { id: string } | null, loginAt = Date.now()) {
  harness.session = user ? { user: { id: user.id }, loginAt } : null;
}

export function fromIp(ip: string) {
  harness.headers = { ...harness.headers, "x-forwarded-for": ip };
}

// Turns a query call into the same shape as an action result.
export async function settle(run: () => Promise<unknown>): Promise<{ ok: boolean; code?: string; data?: unknown }> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    return { ok: false, code: toSafeError(err).code };
  }
}

export async function callRoute<P extends Record<string, string>>(
  GET: (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>,
  path: string,
  params?: P,
  cookie?: string,
) {
  const req = new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
  const res = await GET(req, { params: Promise.resolve(params ?? ({} as P)) });
  return { status: res.status, cache: res.headers.get("cache-control"), body: await res.json() };
}

// ---------- Makers ----------

let n = 0;
const uniq = () => `${Date.now().toString(36)}-${++n}`;

export async function makeCategory(type: "EQUIPMENT" | "PRODUCT" | "SERVICE" = "EQUIPMENT", division: string = type === "PRODUCT" ? "MATERIALS" : type === "SERVICE" ? "INSPECTION_TESTING" : "EQUIPMENT", slug?: string) {
  return db.category.create({ data: { name: `Cat ${uniq()}`, slug: slug ?? `cat-${uniq()}`, type, division: division as never }, select: { id: true, slug: true } });
}

export async function makeVendor(data: Partial<{ status: "PENDING" | "APPROVED" | "INACTIVE"; isPartner: boolean; phone: string; email: string; logo: string; website: string; type: string }> = {}) {
  return db.vendor.create({
    data: { name: `Vendor ${uniq()}`, type: (data.type ?? "SUPPLIER") as never, offerings: "Things", status: data.status ?? "APPROVED", isPartner: data.isPartner ?? false, phone: data.phone, email: data.email ?? `v-${uniq()}@example.test`, logo: data.logo, website: data.website },
    select: { id: true },
  });
}

export async function makeEquipment(data: Partial<{ status: "PENDING" | "AVAILABLE" | "RENTED" | "SOLD" | "INACTIVE"; ownerId: string; categoryId: string; forRent: boolean; forSale: boolean }> = {}) {
  const categoryId = data.categoryId ?? (await makeCategory("EQUIPMENT")).id;
  return db.equipment.create({
    data: { categoryId, ownerId: data.ownerId, name: `Machine ${uniq()}`, slug: `machine-${uniq()}`, description: "A good machine for tests.", images: [], location: "Kigali", forRent: data.forRent ?? true, forSale: data.forSale ?? true, rentPrice: 1000, rentUnit: "DAY", status: data.status ?? "AVAILABLE" },
    select: { id: true, slug: true },
  });
}

export async function makeProduct(data: Partial<{ isAvailable: boolean; categoryId: string; supplierId: string }> = {}) {
  const categoryId = data.categoryId ?? (await makeCategory("PRODUCT")).id;
  return db.product.create({ data: { categoryId, supplierId: data.supplierId, name: `Product ${uniq()}`, slug: `product-${uniq()}`, description: "A product for tests.", images: [], unit: "BAG", price: 5000, isAvailable: data.isAvailable ?? true }, select: { id: true, slug: true } });
}

export async function makeService(data: Partial<{ isActive: boolean; division: string }> = {}) {
  const category = await makeCategory("SERVICE", data.division ?? "INSPECTION_TESTING");
  return db.service.create({ data: { categoryId: category.id, name: `Service ${uniq()}`, slug: `service-${uniq()}`, summary: "A service.", description: "A service for tests.", isActive: data.isActive ?? true }, select: { id: true, slug: true } });
}

export async function makeClient(data: Partial<{ phone: string; email: string; name: string }> = {}) {
  return db.client.create({ data: { name: data.name ?? `Client ${uniq()}`, phone: data.phone, email: data.email ?? (data.phone ? undefined : `c-${uniq()}@example.test`) }, select: { id: true } });
}

export async function makeServiceRequest(data: Partial<{ clientId: string; quotedAmount: number | null; paymentPlan: "FULL" | "INSTALLMENT"; status: string }> = {}) {
  const clientId = data.clientId ?? (await makeClient()).id;
  const service = await makeService();
  return db.serviceRequest.create({
    data: { clientId, serviceId: service.id, details: "Details", siteLocation: "Kigali", quotedAmount: data.quotedAmount === undefined ? 300000 : data.quotedAmount, paymentPlan: data.paymentPlan ?? "FULL", status: (data.status ?? "NEW") as never },
    select: { id: true, number: true },
  });
}

export async function makeJob(data: Partial<{ isPublished: boolean; status: "NEW" | "RECRUITING" | "FILLED" | "CLOSED"; deadline: Date | null }> = {}) {
  const client = await makeClient();
  return db.workforceRequest.create({
    data: { clientId: client.id, role: "Steel fixer", quantity: 3, duration: "2 months", siteLocation: "Kicukiro, Kigali", isPublished: data.isPublished ?? true, status: data.status ?? "RECRUITING", jobDescription: "Fix steel.", deadline: data.deadline === undefined ? null : data.deadline },
    select: { id: true, number: true },
  });
}

// A public contact block for submit actions (new client).
export const newContact = (phone = "0788123456") => ({ returning: false, phone, email: "", name: "Jean Test", entityType: "INDIVIDUAL" as const, companyName: "", tin: "", district: "Gasabo" });

// Output check (DNSA 28.4): forbidden keys never appear in a result.
export function forbiddenKeys(value: unknown, keys: string[]): string[] {
  const json = JSON.stringify(value ?? null);
  return keys.filter((k) => new RegExp(`"${k}"\\s*:`).test(json));
}
