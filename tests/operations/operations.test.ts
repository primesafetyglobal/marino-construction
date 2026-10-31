// Operations rules (docs/modules/operations.md).

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/validation/db";
import * as eqReq from "@/server/modules/operations/equipment-request/equipment-request.actions";
import * as eqReqQueries from "@/server/modules/operations/equipment-request/equipment-request.queries";
import * as so from "@/server/modules/operations/supply-order/supply-order.actions";
import * as sr from "@/server/modules/operations/service-request/service-request.actions";
import * as wr from "@/server/modules/operations/workforce-request/workforce-request.actions";
import * as wrQueries from "@/server/modules/operations/workforce-request/workforce-request.queries";
import * as wrRoutes from "@/server/modules/operations/workforce-request/workforce-request.routes";
import * as ja from "@/server/modules/operations/job-application/job-application.actions";
import { getPayableServiceRequest } from "@/server/modules/operations/service-request/service-request.service";
import { harness } from "../auth/harness";
import { callRoute, forbiddenKeys, makeClient, makeEquipment, makeJob, makeProduct, makeService, makeUser, makeVendor, newContact, resetDb, settle, signInAs } from "../auth/fixtures";

const consent = { consent: true as const };
const staff = async () => {
  const u = await makeUser({ role: "STAFF" });
  signInAs(u);
  return u;
};
const rent = (equipmentId?: string, extra: Record<string, unknown> = {}) => ({ equipmentId, type: "RENT" as const, details: "5 days with operator", siteLocation: "Kicukiro", ...newContact(), ...consent, ...extra });
const applicant = (phone: string, extra: Record<string, unknown> = {}) => ({
  returning: false,
  phone,
  fullName: "Eric Mason",
  dateOfBirth: "1995-05-10",
  trade: "Mason",
  experience: "5 years",
  consent: true,
  ...extra,
});

beforeEach(resetDb);

describe("operations rules", () => {
  it("OPS-R1 codes follow the number of each request type", async () => {
    signInAs(null);
    const a = await eqReq.submitEquipmentRequest(rent());
    const b = await eqReq.submitEquipmentRequest(rent(undefined, { phone: "0788000002" }));
    expect(a).toEqual({ ok: true, data: { code: "EQ-0001" } });
    expect(b).toEqual({ ok: true, data: { code: "EQ-0002" } });
    expect(await so.submitSupplyOrder({ items: "50 bags cement", deliveryLocation: "Gasabo", ...newContact("0788000003"), ...consent })).toEqual({ ok: true, data: { code: "SO-0001" } });
  });

  it("OPS-R2 a public request finds the client by phone, then email, never overwrites, and replies with the code only", async () => {
    signInAs(null);
    const first = await eqReq.submitEquipmentRequest(rent(undefined, { email: "jean@example.com" }));
    expect(first.ok && Object.keys(first.data)).toEqual(["code"]);
    // Returning by email only: same client, stored name kept.
    await eqReq.submitEquipmentRequest(rent(undefined, { returning: true, phone: "", email: "JEAN@example.com", name: "" }));
    // New details with a known phone: still the same client, nothing changed.
    await eqReq.submitEquipmentRequest(rent(undefined, { name: "Somebody Else", district: "Huye" }));
    expect(await db.client.count()).toBe(1);
    expect(await db.client.findFirstOrThrow()).toMatchObject({ name: "Jean Test", district: "Gasabo", phone: "+250788123456" });
    expect(await db.equipmentRequest.count()).toBe(3);
    // Returning with an unknown contact.
    expect(await eqReq.submitEquipmentRequest(rent(undefined, { returning: true, phone: "0788999999", name: "" }))).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { phone: expect.any(Array) } } });
  });

  it("OPS-R3 public requests are NEW + WEBSITE; staff requests need an existing client and a staff source", async () => {
    signInAs(null);
    await sr.submitServiceRequest({ serviceId: (await makeService()).id, details: "Inspect", siteLocation: "Kigali", ...newContact(), ...consent });
    expect(await db.serviceRequest.findFirstOrThrow()).toMatchObject({ status: "NEW", source: "WEBSITE" });
    await staff();
    const client = await makeClient();
    expect(await eqReq.createEquipmentRequest({ clientId: client.id, source: "WEBSITE", type: "BUY", details: "x", siteLocation: "y" } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await eqReq.createEquipmentRequest({ clientId: crypto.randomUUID(), source: "PHONE", type: "BUY", details: "xyz", siteLocation: "Kigali" })).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { clientId: expect.any(Array) } } });
    expect(await eqReq.createEquipmentRequest({ clientId: client.id, source: "WALK_IN", type: "BUY", details: "xyz", siteLocation: "Kigali" })).toMatchObject({ ok: true, data: { status: "NEW", code: "EQ-0001" } });
    expect(await db.equipmentRequest.findFirstOrThrow()).toMatchObject({ source: "WALK_IN" });
  });

  it("OPS-R4 every allowed and refused status move; requests are never deleted (no delete action)", async () => {
    await staff();
    const client = await makeClient();
    const order = await db.supplyOrder.create({ data: { clientId: client.id, items: "x", deliveryLocation: "y" } });
    expect(await so.setSupplyOrderStatus({ id: order.id, status: "DELIVERED" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    for (const s of ["QUOTED", "CONFIRMED", "DELIVERED"] as const) expect(await so.setSupplyOrderStatus({ id: order.id, status: s })).toMatchObject({ ok: true });
    expect(await so.setSupplyOrderStatus({ id: order.id, status: "CANCELLED" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(Object.keys(so).some((k) => k.startsWith("delete"))).toBe(false);
    expect(Object.keys(eqReq).some((k) => k.startsWith("delete"))).toBe(false);
  });

  it("OPS-R5 end date before start is refused; ACTIVE is only for rentals", async () => {
    signInAs(null);
    expect(await eqReq.submitEquipmentRequest(rent(undefined, { startDate: "2026-12-10", endDate: "2026-12-01" }))).toMatchObject({ ok: false, error: { fieldErrors: { endDate: expect.any(Array) } } });
    await staff();
    const machine = await makeEquipment();
    const client = await makeClient();
    const buy = await db.equipmentRequest.create({ data: { type: "BUY", clientId: client.id, equipmentId: machine.id, details: "x", siteLocation: "y", status: "CONFIRMED" } });
    expect(await eqReq.setEquipmentRequestStatus({ id: buy.id, status: "ACTIVE" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("OPS-R6 rental ACTIVE → RENTED, COMPLETED → AVAILABLE; a sale COMPLETED → SOLD and hidden", async () => {
    await staff();
    const machine = await makeEquipment();
    const client = await makeClient();
    const r = await db.equipmentRequest.create({ data: { type: "RENT", clientId: client.id, equipmentId: machine.id, details: "x", siteLocation: "y", status: "CONFIRMED" } });
    expect(await eqReq.setEquipmentRequestStatus({ id: r.id, status: "ACTIVE" })).toMatchObject({ ok: true });
    expect((await db.equipment.findUniqueOrThrow({ where: { id: machine.id } })).status).toBe("RENTED");
    expect(await eqReq.setEquipmentRequestStatus({ id: r.id, status: "COMPLETED" })).toMatchObject({ ok: true });
    expect((await db.equipment.findUniqueOrThrow({ where: { id: machine.id } })).status).toBe("AVAILABLE");
    const sale = await db.equipmentRequest.create({ data: { type: "BUY", clientId: client.id, equipmentId: machine.id, details: "x", siteLocation: "y", status: "CONFIRMED" } });
    expect(await eqReq.setEquipmentRequestStatus({ id: sale.id, status: "COMPLETED" })).toMatchObject({ ok: true });
    expect((await db.equipment.findUniqueOrThrow({ where: { id: machine.id } })).status).toBe("SOLD");
    const history = await eqReqQueries.getEquipmentRentHistory({ equipmentId: machine.id });
    expect(history.map((h) => h.code)).toEqual(["EQ-0001"]);
  });

  it("OPS-R7 one ACTIVE rental per equipment, also under parallel activations", async () => {
    await staff();
    const machine = await makeEquipment();
    const client = await makeClient();
    const reqs = await Promise.all(
      [1, 2, 3, 4].map(() => db.equipmentRequest.create({ data: { type: "RENT", clientId: client.id, equipmentId: machine.id, details: "x", siteLocation: "y", status: "CONFIRMED" } })),
    );
    const results = await Promise.all(reqs.map((r) => eqReq.setEquipmentRequestStatus({ id: r.id, status: "ACTIVE" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.equipmentRequest.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("OPS-R8 only APPROVED vendors can be linked to supply orders and service requests", async () => {
    await staff();
    const client = await makeClient();
    const order = await db.supplyOrder.create({ data: { clientId: client.id, items: "x", deliveryLocation: "y" } });
    const pending = await makeVendor({ status: "PENDING" });
    const approved = await makeVendor({ status: "APPROVED" });
    expect(await so.updateSupplyOrder({ id: order.id, vendorId: pending.id })).toMatchObject({ ok: false, error: { fieldErrors: { vendorId: expect.any(Array) } } });
    expect(await so.updateSupplyOrder({ id: order.id, vendorId: approved.id })).toMatchObject({ ok: true });
  });

  it("OPS-R9 DELIVERED sets deliveredAt in the same change", async () => {
    await staff();
    const client = await makeClient();
    const service = await makeService();
    const r = await db.serviceRequest.create({ data: { clientId: client.id, serviceId: service.id, details: "x", siteLocation: "y", status: "IN_PROGRESS" } });
    expect(await sr.setServiceRequestStatus({ id: r.id, status: "DELIVERED" })).toMatchObject({ ok: true });
    expect((await db.serviceRequest.findUniqueOrThrow({ where: { id: r.id } })).deliveredAt).toBeInstanceOf(Date);
  });

  it("OPS-R10 public requests need public items (equipment, product, service)", async () => {
    signInAs(null);
    const pending = await makeEquipment({ status: "PENDING" });
    expect(await eqReq.submitEquipmentRequest(rent(pending.id))).toMatchObject({ ok: false, error: { fieldErrors: { equipmentId: expect.any(Array) } } });
    const hidden = await makeProduct({ isAvailable: false });
    expect(await so.submitSupplyOrder({ productId: hidden.id, items: "x y z", deliveryLocation: "Kigali", ...newContact(), ...consent })).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { productId: expect.any(Array) } } });
    const inactive = await makeService({ isActive: false });
    expect(await sr.submitServiceRequest({ serviceId: inactive.id, details: "x y", siteLocation: "Kigali", ...newContact(), ...consent })).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { serviceId: expect.any(Array) } } });
    expect(await db.client.count()).toBe(0);
  });

  it("OPS-R11 publishing needs a description; a post is public only when published, RECRUITING and before its deadline; no client data", async () => {
    await staff();
    const client = await makeClient({ name: "Secret Client Co" });
    const w = await db.workforceRequest.create({ data: { clientId: client.id, role: "Welder", quantity: 2, duration: "1 month", siteLocation: "Remera, Gasabo" } });
    expect(await wr.publishJob({ id: w.id })).toMatchObject({ ok: false, error: { fieldErrors: { jobDescription: expect.any(Array) } } });
    expect(await wr.publishJob({ id: w.id, jobDescription: "Weld things." })).toMatchObject({ ok: true, data: { status: "RECRUITING", isPublished: true } });
    signInAs(null);
    const job = await wrQueries.getJobByNumber({ number: String(w.number) });
    expect(job).toMatchObject({ code: "WR-0001", district: "Gasabo" });
    expect(forbiddenKeys(job, ["client", "clientId", "notes", "handledBy", "siteLocation"])).toEqual([]);
    expect(JSON.stringify(job)).not.toContain("Secret Client");
    const route = await callRoute(wrRoutes.getJobRoute, `/api/v1/operations/job/${w.number}`, { number: String(w.number) });
    expect(route.status).toBe(200);
    await makeJob({ deadline: new Date("2020-01-01T00:00:00Z") });
    await makeJob({ status: "FILLED" });
    await makeJob({ isPublished: false });
    expect((await wrQueries.getOpenJobs({})).items.map((j) => j.number)).toEqual([w.number]);
    expect(await settle(() => wrQueries.getJobByNumber({ number: "abc" }))).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("OPS-R12 one application per applicant per post; only open posts accept applications", async () => {
    signInAs(null);
    const open = await makeJob();
    expect(await ja.submitApplication({ jobNumber: open.number, ...applicant("0788200001") })).toEqual({ ok: true, data: { received: true } });
    expect(await ja.submitApplication({ jobNumber: open.number, returning: true, phone: "0788200001" })).toMatchObject({ ok: false, error: { code: "CONFLICT", message: "You already applied to this job." } });
    const closed = await makeJob({ status: "CLOSED" });
    expect(await ja.submitApplication({ jobNumber: closed.number, returning: true, phone: "0788200001" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("OPS-R13 a new applicant needs consent and 18+; a returning one applies with phone only and the profile is reused, unchanged", async () => {
    signInAs(null);
    const a = await makeJob();
    const b = await makeJob();
    expect(await ja.submitApplication({ jobNumber: a.number, ...applicant("0788200002", { consent: false }) })).toMatchObject({ ok: false, error: { fieldErrors: { consent: expect.any(Array) } } });
    expect(await ja.submitApplication({ jobNumber: a.number, ...applicant("0788200002", { dateOfBirth: "2015-01-01" }) })).toMatchObject({ ok: false, error: { fieldErrors: { dateOfBirth: expect.any(Array) } } });
    expect(await ja.submitApplication({ jobNumber: a.number, ...applicant("0788200002") })).toMatchObject({ ok: true });
    expect(await ja.submitApplication({ jobNumber: b.number, returning: true, phone: "078 820 0002", message: "Me again" })).toMatchObject({ ok: true });
    // A "new" form with a known phone reuses the stored profile and changes nothing.
    const c = await makeJob();
    await ja.submitApplication({ jobNumber: c.number, ...applicant("0788200002", { fullName: "Changed Name", trade: "Welder" }) });
    expect(await db.applicant.count()).toBe(1);
    expect(await db.applicant.findFirstOrThrow()).toMatchObject({ fullName: "Eric Mason", trade: "Mason" });
    expect(await db.jobApplication.count()).toBe(3);
  });

  it("OPS-R14 the handler must be an active user", async () => {
    const me = await staff();
    const client = await makeClient();
    const r = await db.supplyOrder.create({ data: { clientId: client.id, items: "x", deliveryLocation: "y" } });
    const inactive = await makeUser({ active: false });
    expect(await so.setSupplyOrderHandler({ id: r.id, handledById: inactive.id })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await so.setSupplyOrderHandler({ id: r.id, handledById: me.id })).toMatchObject({ ok: true });
  });

  it("OPS-R15 staff are emailed after commit; a failed email does not fail the request", async () => {
    signInAs(null);
    await wr.submitWorkforceRequest({ role: "Masons", quantity: 3, duration: "2 weeks", siteLocation: "Huye", ...newContact(), ...consent });
    expect(harness.mails).toHaveLength(1);
    expect(harness.mails[0]).toMatchObject({ to: "staff@example.test", subject: expect.stringContaining("WR-0001") });
    harness.mailFails = true;
    expect(await wr.submitWorkforceRequest({ role: "Masons", quantity: 3, duration: "2 weeks", siteLocation: "Huye", ...newContact(), ...consent })).toEqual({ ok: true, data: { code: "WR-0002" } });
  });

  it("OPS-R16 honeypot gives a fake code and saves nothing; consent required; 6th request in a minute is RATE_LIMITED", async () => {
    signInAs(null);
    const fake = await eqReq.submitEquipmentRequest(rent(undefined, { fax: "I am a bot" }));
    expect(fake).toMatchObject({ ok: true, data: { code: expect.stringMatching(/^EQ-\d{4}$/) } });
    expect(await db.equipmentRequest.count()).toBe(0);
    expect(await eqReq.submitEquipmentRequest(rent(undefined, { consent: false }) as never)).toMatchObject({ ok: false, error: { fieldErrors: { consent: expect.any(Array) } } });
    for (let i = 0; i < 5; i++) await eqReq.submitEquipmentRequest(rent());
    expect(await eqReq.submitEquipmentRequest(rent())).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });

  it("OPS-R17 getPayableServiceRequest gives payments the quoted amount and plan", async () => {
    const client = await makeClient();
    const service = await makeService();
    const r = await db.serviceRequest.create({ data: { clientId: client.id, serviceId: service.id, details: "x", siteLocation: "y", paymentPlan: "INSTALLMENT", quotedAmount: 450000 } });
    expect(await getPayableServiceRequest(r.id, db)).toMatchObject({ quotedAmount: 450000, paymentPlan: "INSTALLMENT" });
  });
});
