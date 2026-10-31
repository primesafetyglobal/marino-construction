// Parties & payments rules (docs/modules/parties.md).

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/validation/db";
import * as clients from "@/server/modules/parties/client/client.actions";
import * as vendors from "@/server/modules/parties/vendor/vendor.actions";
import * as vendorQueries from "@/server/modules/parties/vendor/vendor.queries";
import * as applicants from "@/server/modules/parties/applicant/applicant.actions";
import * as applicantQueries from "@/server/modules/parties/applicant/applicant.queries";
import * as payments from "@/server/modules/parties/payment/payment.actions";
import * as paymentQueries from "@/server/modules/parties/payment/payment.queries";
import * as contactCheck from "@/server/modules/parties/contact-check/contact-check.queries";
import { findOrCreateClient } from "@/server/modules/parties/client/client.service";
import { findOrCreateApplicant } from "@/server/modules/parties/applicant/applicant.service";
import { today } from "@/server/modules/parties/parties.dates";
import { forbiddenKeys, makeClient, makeEquipment, makeServiceRequest, makeUser, makeVendor, resetDb, settle, signInAs } from "../auth/fixtures";

const asRole = async (role: "STAFF" | "ADMIN" = "STAFF") => signInAs(await makeUser({ role }));
const addDays = (n: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

beforeEach(resetDb);

describe("parties rules", () => {
  it("PTY-R1 phone or email required; stored normalised; unique per model with a field error", async () => {
    await asRole();
    expect(await clients.createClient({ name: "No Contact" })).toMatchObject({ ok: false, error: { fieldErrors: { phone: expect.any(Array) } } });
    expect(await clients.createClient({ name: "Jean", phone: "0788 111 222", email: "JEAN@Example.com" })).toMatchObject({ ok: true });
    expect(await db.client.findFirstOrThrow()).toMatchObject({ phone: "+250788111222", email: "jean@example.com" });
    expect(await clients.createClient({ name: "Other", phone: "+250788111222" })).toMatchObject({ ok: false, error: { code: "CONFLICT", fieldErrors: { phone: expect.any(Array) } } });
  });

  it("PTY-R2 COMPANY needs a company name; TIN is 9 digits and unique", async () => {
    await asRole();
    expect(await clients.createClient({ name: "Ann", phone: "0788111223", entityType: "COMPANY" })).toMatchObject({ ok: false, error: { fieldErrors: { companyName: expect.any(Array) } } });
    expect(await clients.createClient({ name: "Ann", phone: "0788111223", entityType: "COMPANY", companyName: "A Ltd", tin: "12345" })).toMatchObject({ ok: false, error: { fieldErrors: { tin: expect.any(Array) } } });
    expect(await clients.createClient({ name: "Ann", phone: "0788111223", entityType: "COMPANY", companyName: "A Ltd", tin: "123456789" })).toMatchObject({ ok: true });
    expect(await clients.createClient({ name: "Bob", phone: "0788111224", entityType: "COMPANY", companyName: "B Ltd", tin: "123456789" })).toMatchObject({ ok: false, error: { fieldErrors: { tin: expect.any(Array) } } });
  });

  it("PTY-R3 find by phone, then email; never overwrite; unknown returning contact is VALIDATION", async () => {
    const existing = await makeClient({ phone: "+250788333444", name: "Stored Name" });
    const byPhone = await db.$transaction((tx) => findOrCreateClient({ returning: false, phone: "0788333444", email: null, name: "New Name", entityType: "INDIVIDUAL", companyName: null, tin: null, district: "Huye" }, tx));
    expect(byPhone).toEqual({ id: existing.id, created: false });
    expect((await db.client.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe("Stored Name");
    const byEmail = await makeClient({ email: "found@example.com" });
    expect(await db.$transaction((tx) => findOrCreateClient({ returning: true, phone: "0788000777", email: "FOUND@example.com", name: null, entityType: "INDIVIDUAL", companyName: null, tin: null, district: null }, tx))).toEqual({ id: byEmail.id, created: false });
    await expect(db.$transaction((tx) => findOrCreateClient({ returning: true, phone: "0788000778", email: null, name: null, entityType: "INDIVIDUAL", companyName: null, tin: null, district: null }, tx))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("PTY-R4 a client with requests cannot be deleted", async () => {
    await asRole("ADMIN");
    const r = await makeServiceRequest();
    const owner = await db.serviceRequest.findUniqueOrThrow({ where: { id: r.id }, select: { clientId: true } });
    expect(await clients.deleteClient({ id: owner.clientId })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const lonely = await makeClient();
    expect(await clients.deleteClient({ id: lonely.id })).toMatchObject({ ok: true });
  });

  it("PTY-R5 new vendors are PENDING; partner only when APPROVED; deactivating removes the badge", async () => {
    await asRole("ADMIN");
    const created = await vendors.createVendor({ name: "Supplier", phone: "0788444555", type: "SUPPLIER", offerings: "Cement" });
    if (!created.ok) throw new Error("expected ok");
    expect(created.data.status).toBe("PENDING");
    expect(await vendors.setVendorPartner({ id: created.data.id, isPartner: true })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await vendors.setVendorStatus({ id: created.data.id, status: "APPROVED" })).toMatchObject({ ok: true });
    expect(await vendors.setVendorPartner({ id: created.data.id, isPartner: true })).toMatchObject({ ok: true, data: { isPartner: true } });
    expect(await vendors.setVendorStatus({ id: created.data.id, status: "INACTIVE" })).toMatchObject({ ok: true, data: { isPartner: false } });
  });

  it("PTY-R6 a vendor linked to equipment cannot be deleted", async () => {
    await asRole("ADMIN");
    const v = await makeVendor();
    await makeEquipment({ ownerId: v.id });
    expect(await vendors.deleteVendor({ id: v.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("PTY-R7 partners: logo row and featured shops expose name, company name, logo and website only", async () => {
    await makeVendor({ isPartner: true, logo: "https://cdn.example/logo.png", phone: "+250788999000" });
    await makeVendor({ isPartner: true, type: "SUPPLIER", website: "https://shop.example" });
    await makeVendor({ isPartner: false, logo: "https://cdn.example/x.png" });
    await makeVendor({ isPartner: true, status: "PENDING", logo: "https://cdn.example/y.png" });
    signInAs(null);
    const result = await vendorQueries.getPartners({});
    expect(result.partners).toHaveLength(1);
    expect(result.shops).toHaveLength(1);
    expect(forbiddenKeys(result, ["phone", "email", "tin", "notes", "status", "offerings"])).toEqual([]);
  });

  it("PTY-R8 applicants: 18+ on the day of applying, consent required to create, DOB / gender admin only, no delete with applications", async () => {
    const tooYoung = { returning: false, phone: "0788600001", email: null, fullName: "Kid", dateOfBirth: addDays(-17 * 365), gender: null, trade: "Mason", experience: "1 year", district: null, cv: null, details: null, consent: true };
    await expect(db.$transaction((tx) => findOrCreateApplicant(tooYoung, tx))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(db.$transaction((tx) => findOrCreateApplicant({ ...tooYoung, dateOfBirth: "1990-01-01", consent: false }, tx))).rejects.toMatchObject({ code: "VALIDATION" });
    const ok = await db.$transaction((tx) => findOrCreateApplicant({ ...tooYoung, dateOfBirth: "1990-01-01" }, tx));
    expect(ok.created).toBe(true);
    expect((await db.applicant.findUniqueOrThrow({ where: { id: ok.id } })).consentAt).toBeInstanceOf(Date);
    signInAs(null);
    expect(await settle(() => applicantQueries.getApplicant({ id: ok.id }))).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    await asRole("ADMIN");
    const job = await db.workforceRequest.create({ data: { clientId: (await makeClient()).id, role: "R", quantity: 1, duration: "d", siteLocation: "s" } });
    await db.jobApplication.create({ data: { workforceRequestId: job.id, applicantId: ok.id } });
    expect(await applicants.deleteApplicant({ id: ok.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("PTY-R9 a payment belongs to exactly one request, named by type and id", async () => {
    await asRole();
    const r = await makeServiceRequest({ quotedAmount: 100000 });
    expect(await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 1000, method: "CASH" })).toMatchObject({ ok: true });
    const p = await db.payment.findFirstOrThrow();
    expect([p.equipmentRequestId, p.supplyOrderId, p.serviceRequestId].filter(Boolean)).toEqual([r.id]);
    expect(await payments.recordPayment({ requestType: "SUPPLY_ORDER", requestId: r.id, amount: 1000, method: "CASH" })).toMatchObject({ ok: false, error: { fieldErrors: { requestId: expect.any(Array) } } });
  });

  it("PTY-R10 PAID needs a method; paidAt is set when PAID", async () => {
    await asRole();
    const r = await makeServiceRequest({ quotedAmount: 100000 });
    expect(await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 1000 })).toMatchObject({ ok: false, error: { fieldErrors: { method: expect.any(Array) } } });
    await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 1000, status: "DUE", dueDate: addDays(5) });
    const due = await db.payment.findFirstOrThrow();
    expect(due.paidAt).toBeNull();
    expect(await payments.markPaymentPaid({ id: due.id, method: "MOMO", reference: "MP123" })).toMatchObject({ ok: true, data: { status: "PAID" } });
    expect((await db.payment.findUniqueOrThrow({ where: { id: due.id } })).paidAt).toBeInstanceOf(Date);
    expect(await payments.markPaymentPaid({ id: due.id, method: "MOMO" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("PTY-R11 installments need INSTALLMENT and a quote, add up exactly; payments never exceed the quote (also in parallel)", async () => {
    await asRole();
    const full = await makeServiceRequest({ quotedAmount: 450000 });
    const plan = (id: string, amounts: number[]) => payments.createInstallmentPlan({ serviceRequestId: id, installments: amounts.map((a, i) => ({ amount: a, dueDate: addDays(30 * (i + 1)) })) });
    expect(await plan(full.id, [150000, 150000, 150000])).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const noQuote = await makeServiceRequest({ paymentPlan: "INSTALLMENT", quotedAmount: null });
    expect(await plan(noQuote.id, [1, 2])).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const paint = await makeServiceRequest({ paymentPlan: "INSTALLMENT", quotedAmount: 450000 });
    expect(await plan(paint.id, [150000, 150000, 100000])).toMatchObject({ ok: false, error: { fieldErrors: { installments: expect.any(Array) } } });
    expect(await plan(paint.id, [150000, 150000, 150000])).toMatchObject({ ok: true, data: { count: 3 } });
    expect(await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: paint.id, amount: 1, method: "CASH" })).toMatchObject({ ok: false });
    // Parallel payments on a 20,000 quote, in several waves: the total never exceeds it.
    for (let wave = 0; wave < 5; wave++) {
      const r = await makeServiceRequest({ quotedAmount: 20000 });
      await Promise.all(Array.from({ length: 12 }, () => payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 10000, method: "CASH" })));
      const total = await db.payment.aggregate({ where: { serviceRequestId: r.id }, _sum: { amount: true } });
      expect(total._sum.amount).toBeLessThanOrEqual(20000);
    }
  });

  it("PTY-R12 PAID payments cannot be deleted; DUE ones can (Staff)", async () => {
    await asRole("STAFF");
    const r = await makeServiceRequest({ quotedAmount: 100000 });
    await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 1000, method: "CASH" });
    await payments.recordPayment({ requestType: "SERVICE_REQUEST", requestId: r.id, amount: 1000, status: "DUE", dueDate: addDays(3) });
    const [paid, due] = await Promise.all([db.payment.findFirstOrThrow({ where: { status: "PAID" } }), db.payment.findFirstOrThrow({ where: { status: "DUE" } })]);
    expect(await payments.deletePayment({ id: paid.id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await payments.deletePayment({ id: due.id })).toMatchObject({ ok: true });
  });

  it("PTY-R13 overdue = DUE before today (Kigali); totals and the request summary agree", async () => {
    await asRole();
    const r = await makeServiceRequest({ paymentPlan: "INSTALLMENT", quotedAmount: 300000 });
    await db.payment.createMany({
      data: [
        { serviceRequestId: r.id, amount: 100000, status: "PAID", method: "MOMO", paidAt: new Date() },
        { serviceRequestId: r.id, amount: 100000, status: "DUE", dueDate: new Date(`${addDays(-3)}T00:00:00Z`) },
        { serviceRequestId: r.id, amount: 100000, status: "DUE", dueDate: new Date(`${today()}T00:00:00Z`) },
      ],
    });
    const overdue = await paymentQueries.getOverduePayments({});
    expect(overdue.map((p) => p.dueDate)).toEqual([addDays(-3)]);
    expect(await paymentQueries.getOverdueCount({})).toBe(1);
    const summary = await paymentQueries.getPaymentsByRequest({ requestType: "SERVICE_REQUEST", requestId: r.id });
    expect(summary.summary).toEqual({ quotedAmount: 300000, paid: 100000, due: 200000, outstanding: 200000, overdue: 100000 });
    expect(await paymentQueries.getPaymentSummary({})).toEqual({ paid: 100000, due: 200000, overdue: 100000 });
  });

  it("PTY-R14 the contact check answers only { known }", async () => {
    await makeClient({ phone: "+250788777888" });
    signInAs(null);
    expect(await contactCheck.checkContact({ for: "client", phone: "0788 777 888" })).toEqual({ known: true });
    expect(await contactCheck.checkContact({ for: "vendor", phone: "0788777888" })).toEqual({ known: false });
    for (let i = 0; i < 8; i++) await contactCheck.checkContact({ for: "client", email: `x${i}@example.com` });
    expect(await settle(() => contactCheck.checkContact({ for: "client", phone: "0788777888" }))).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("PTY-R15 public vendor registration: PENDING, honeypot fake success, consent, reply reveals nothing", async () => {
    signInAs(null);
    const input = { returning: false, phone: "0788123123", name: "Garage One", type: "GARAGE" as const, offerings: "Servicing", consent: true as const };
    expect(await vendors.submitVendor({ ...input, fax: "bot" })).toEqual({ ok: true, data: { received: true } });
    expect(await db.vendor.count()).toBe(0);
    expect(await vendors.submitVendor({ ...input, consent: false } as never)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await vendors.submitVendor(input)).toEqual({ ok: true, data: { received: true } });
    expect(await vendors.submitVendor({ ...input, name: "Changed" })).toEqual({ ok: true, data: { received: true } });
    expect(await db.vendor.findFirstOrThrow()).toMatchObject({ status: "PENDING", name: "Garage One" });
  });
});
