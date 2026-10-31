// Catalog rules (docs/modules/catalog.md). Real PostgreSQL; only the
// framework edges are test doubles.

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/validation/db";
import * as categoryActions from "@/server/modules/catalog/category/category.actions";
import * as equipmentActions from "@/server/modules/catalog/equipment/equipment.actions";
import * as equipmentQueries from "@/server/modules/catalog/equipment/equipment.queries";
import * as equipmentRoutes from "@/server/modules/catalog/equipment/equipment.routes";
import * as productQueries from "@/server/modules/catalog/product/product.queries";
import * as serviceActions from "@/server/modules/catalog/service/service.actions";
import * as serviceQueries from "@/server/modules/catalog/service/service.queries";
import * as trainingActions from "@/server/modules/catalog/training/training.actions";
import * as trainingQueries from "@/server/modules/catalog/training/training.queries";
import * as searchQueries from "@/server/modules/catalog/search/search.queries";
import { harness } from "../auth/harness";
import { callRoute, forbiddenKeys, makeCategory, makeEquipment, makeProduct, makeUser, makeVendor, resetDb, settle, signInAs } from "../auth/fixtures";

const asAdmin = async () => signInAs(await makeUser({ role: "ADMIN" }));
// Action inputs are built loosely on purpose: the tests also send invalid ones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const equipmentInput = (categoryId: string, extra: Record<string, unknown> = {}): any => ({
  categoryId,
  name: "CAT 320 Excavator",
  description: "A reliable 20 tonne excavator.",
  location: "Kigali",
  forRent: true,
  rentPrice: 450000,
  rentUnit: "DAY",
  forSale: false,
  ...extra,
});
const vendorContact = { returning: false, phone: "0788555111", email: "", contactName: "Owner One", entityType: "INDIVIDUAL" as const, companyName: "", tin: "", district: "Gasabo" };

beforeEach(resetDb);

describe("catalog rules", () => {
  it("CAT-R1 slugs are unique; a blank slug is made from the name with -2, -3 …", async () => {
    await asAdmin();
    const cat = await makeCategory("EQUIPMENT");
    const a = await equipmentActions.createEquipment(equipmentInput(cat.id));
    const b = await equipmentActions.createEquipment(equipmentInput(cat.id));
    expect(a).toMatchObject({ ok: true, data: { slug: "cat-320-excavator" } });
    expect(b).toMatchObject({ ok: true, data: { slug: "cat-320-excavator-2" } });
    const taken = await equipmentActions.createEquipment(equipmentInput(cat.id, { slug: "cat-320-excavator" }));
    expect(taken).toMatchObject({ ok: false, error: { code: "CONFLICT", fieldErrors: { slug: expect.any(Array) } } });
  });

  it("CAT-R2 a category's type cannot change once items are attached", async () => {
    await asAdmin();
    const cat = await makeCategory("EQUIPMENT");
    expect(await categoryActions.updateCategory({ id: cat.id, type: "PRODUCT" })).toMatchObject({ ok: true });
    expect(await categoryActions.updateCategory({ id: cat.id, type: "EQUIPMENT" })).toMatchObject({ ok: true });
    await makeEquipment({ categoryId: cat.id });
    expect(await categoryActions.updateCategory({ id: cat.id, type: "PRODUCT" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("CAT-R3 a category with items cannot be deleted; an empty one can", async () => {
    await asAdmin();
    const used = await makeCategory("PRODUCT");
    await makeProduct({ categoryId: used.id });
    expect(await categoryActions.deleteCategory({ id: used.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const empty = await makeCategory("SERVICE");
    expect(await categoryActions.deleteCategory({ id: empty.id })).toMatchObject({ ok: true });
  });

  it("CAT-R4 an item's category must have the matching type", async () => {
    await asAdmin();
    const productCat = await makeCategory("PRODUCT");
    expect(await equipmentActions.createEquipment(equipmentInput(productCat.id))).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { categoryId: expect.any(Array) } } });
  });

  it("CAT-R5 rent and/or sale; a rent price needs a unit; at most 20 spec rows, label and value required", async () => {
    await asAdmin();
    const cat = await makeCategory("EQUIPMENT");
    expect(await equipmentActions.createEquipment(equipmentInput(cat.id, { forRent: false, forSale: false }))).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await equipmentActions.createEquipment(equipmentInput(cat.id, { rentUnit: null }))).toMatchObject({ ok: false, error: { fieldErrors: { rentUnit: expect.any(Array) } } });
    const specs = Array.from({ length: 21 }, (_, i) => ({ label: `L${i}`, value: "v" }));
    expect(await equipmentActions.createEquipment(equipmentInput(cat.id, { specs }))).toMatchObject({ ok: false, error: { fieldErrors: { specs: expect.any(Array) } } });
    expect(await equipmentActions.createEquipment(equipmentInput(cat.id, { specs: [{ label: "Year", value: "" }] }))).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    // Checked again on the merged values of a partial update.
    const ok = await equipmentActions.createEquipment(equipmentInput(cat.id));
    if (!ok.ok) throw new Error("expected ok");
    expect(await equipmentActions.updateEquipment({ id: ok.data.id, forRent: false })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("CAT-R6 only AVAILABLE and RENTED equipment is public, without the owner; the route caches only for visitors", async () => {
    const owner = await makeVendor();
    for (const status of ["PENDING", "AVAILABLE", "RENTED", "SOLD", "INACTIVE"] as const) await makeEquipment({ status, ownerId: owner.id });
    signInAs(null);
    const list = await equipmentQueries.listEquipment({});
    expect(list.view).toBe("public");
    expect(list.items.map((i) => i.status).sort()).toEqual(["AVAILABLE", "RENTED"]);
    expect(forbiddenKeys(list, ["owner", "ownerId", "_count"])).toEqual([]);
    const pending = await db.equipment.findFirstOrThrow({ where: { status: "PENDING" } });
    expect(await settle(() => equipmentQueries.getEquipmentBySlug({ slug: pending.slug }))).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const route = await callRoute(equipmentRoutes.listEquipmentRoute, "/api/v1/catalog/equipment");
    expect(route.status).toBe(200);
    expect(route.cache).toContain("public, s-maxage=300");
    const staffRoute = await callRoute(equipmentRoutes.listEquipmentRoute, "/api/v1/catalog/equipment", undefined, "next-auth.session-token=x");
    expect(staffRoute.cache).toBe("private, no-store");
    // Staff get the admin select with every status.
    signInAs(await makeUser({ role: "STAFF" }));
    const admin = await equipmentQueries.listEquipment({});
    expect(admin.view).toBe("admin");
    expect(admin.items).toHaveLength(5);
  });

  it("CAT-R7 a public submission is PENDING, linked to a vendor found or created (never overwritten); approval needs an APPROVED owner", async () => {
    const cat = await makeCategory("EQUIPMENT");
    signInAs(null);
    const sent = await equipmentActions.submitEquipment({ ...equipmentInput(cat.id), ...vendorContact, consent: true });
    expect(sent).toEqual({ ok: true, data: { received: true } });
    const row = await db.equipment.findFirstOrThrow({ include: { owner: true } });
    expect(row.status).toBe("PENDING");
    expect(row.owner).toMatchObject({ phone: "+250788555111", status: "PENDING", name: "Owner One" });
    expect(harness.mails[0]?.subject).toMatch(/New equipment submission/);
    // A returning owner is found by phone and keeps the stored name.
    await equipmentActions.submitEquipment({ ...equipmentInput(cat.id, { name: "Second machine" }), ...vendorContact, contactName: "Someone Else", consent: true });
    expect(await db.vendor.count()).toBe(1);
    expect((await db.vendor.findFirstOrThrow()).name).toBe("Owner One");
    // Approval: blocked until the owner is approved.
    await asAdmin();
    expect(await equipmentActions.approveEquipment({ id: row.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    await db.vendor.update({ where: { id: row.ownerId! }, data: { status: "APPROVED" } });
    expect(await equipmentActions.approveEquipment({ id: row.id })).toMatchObject({ ok: true, data: { status: "AVAILABLE" } });
  });

  it("CAT-R8 equipment with requests cannot be deleted (set INACTIVE instead)", async () => {
    await asAdmin();
    const machine = await makeEquipment();
    const client = await db.client.create({ data: { name: "C", phone: "+250788000099" } });
    await db.equipmentRequest.create({ data: { type: "RENT", clientId: client.id, equipmentId: machine.id, details: "x", siteLocation: "y" } });
    expect(await equipmentActions.deleteEquipment({ id: machine.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await equipmentActions.setEquipmentStatus({ id: machine.id, status: "INACTIVE" })).toMatchObject({ ok: true });
    const free = await makeEquipment();
    expect(await equipmentActions.deleteEquipment({ id: free.id })).toMatchObject({ ok: true });
  });

  it("CAT-R9 only available products are public; the supplier never is; paint products come from paints-finishes", async () => {
    const supplier = await makeVendor();
    const paints = await makeCategory("PRODUCT", "MATERIALS", "paints-finishes");
    await makeProduct({ categoryId: paints.id, supplierId: supplier.id });
    await makeProduct({ isAvailable: false });
    await makeProduct();
    signInAs(null);
    const list = await productQueries.listProducts({});
    expect(list.items).toHaveLength(2);
    expect(forbiddenKeys(list, ["supplier", "supplierId", "isAvailable"])).toEqual([]);
    expect(await productQueries.getPaintProducts({})).toHaveLength(1);
  });

  it("CAT-R10 service content: at most 10 sections of the four shapes; inactive services are hidden; a service with requests cannot be deleted", async () => {
    await asAdmin();
    const cat = await makeCategory("SERVICE");
    const base = { categoryId: cat.id, name: "Structural Inspections", summary: "Check buildings.", description: "We inspect structures." };
    const eleven = Array.from({ length: 11 }, () => ({ type: "text", title: "T", body: "B" }));
    expect(await serviceActions.createService({ ...base, content: eleven as never })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await serviceActions.createService({ ...base, content: [{ type: "video", title: "x" }] as never })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    const created = await serviceActions.createService({ ...base, content: [{ type: "faq", title: "Q", items: [{ q: "Why?", a: "Because." }] }], isActive: false });
    if (!created.ok) throw new Error("expected ok");
    signInAs(null);
    expect(await settle(() => serviceQueries.getServiceBySlug({ slug: created.data.slug }))).toMatchObject({ ok: false, code: "NOT_FOUND" });
    await asAdmin();
    const client = await db.client.create({ data: { name: "C", email: "c@example.test" } });
    await db.serviceRequest.create({ data: { clientId: client.id, serviceId: created.data.id, details: "x", siteLocation: "y" } });
    expect(await serviceActions.deleteService({ id: created.data.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("CAT-R11 training links are valid https URLs; only published trainings are public", async () => {
    await asAdmin();
    const base = { title: "Working at Height", summary: "Safety at height.", type: "HSE" as const };
    expect(await trainingActions.createTraining({ ...base, externalUrl: "http://insecure.example" })).toMatchObject({ ok: false, error: { fieldErrors: { externalUrl: expect.any(Array) } } });
    expect(await trainingActions.createTraining({ ...base, externalUrl: "https://primesafetyglobal.com/x", isPublished: false })).toMatchObject({ ok: true });
    expect(await trainingActions.createTraining({ ...base, title: "First Aid", externalUrl: "https://primesafetyglobal.com/y" })).toMatchObject({ ok: true });
    signInAs(null);
    expect((await trainingQueries.getPublishedTrainings({})).map((t) => t.title)).toEqual(["First Aid"]);
  });

  it("CAT-R12 status moves only through their actions: no status in the update schema; RENTED and PENDING are never set by hand", async () => {
    await asAdmin();
    const machine = await makeEquipment({ status: "RENTED" });
    expect(await equipmentActions.updateEquipment({ id: machine.id, status: "AVAILABLE" } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await equipmentActions.setEquipmentStatus({ id: machine.id, status: "RENTED" } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await equipmentActions.setEquipmentStatus({ id: machine.id, status: "AVAILABLE" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const sold = await makeEquipment();
    expect(await equipmentActions.setEquipmentStatus({ id: sold.id, status: "SOLD" })).toMatchObject({ ok: true });
    signInAs(null);
    expect((await equipmentQueries.listEquipment({})).items.find((i) => i.id === sold.id)).toBeUndefined();
  });

  it("CAT-R13 public submission: honeypot gives a fake success and saves nothing; consent required; 6th in a minute is RATE_LIMITED", async () => {
    const cat = await makeCategory("EQUIPMENT");
    signInAs(null);
    const input = { ...equipmentInput(cat.id), ...vendorContact, consent: true as const };
    expect(await equipmentActions.submitEquipment({ ...input, fax: "spam" })).toEqual({ ok: true, data: { received: true } });
    expect(await db.equipment.count()).toBe(0);
    expect(await equipmentActions.submitEquipment({ ...input, consent: false } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { consent: expect.any(Array) } } });
    for (let i = 0; i < 5; i++) await equipmentActions.submitEquipment({ ...input, name: `Machine ${i}` });
    expect(await equipmentActions.submitEquipment(input)).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    // Public search is limited to public states.
    await makeEquipment({ status: "PENDING" });
    const found = await searchQueries.searchCatalog({ q: "Machine" });
    expect(found.items.every((i) => i.kind !== "equipment" || i.title.startsWith("Machine"))).toBe(true);
    expect(found.items).toHaveLength(0);
  });
});

