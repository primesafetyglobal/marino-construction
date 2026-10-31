// Filing references and jobs (guide §19 "References", "Jobs").
import "./mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/validation/db";
import { isFilingError } from "@/server/modules/filing/lib/errors";
import { references, setReferences, type FileReference } from "@/server/modules/filing/lib/references/registry";
import { countWithBase, rewriteReference } from "@/server/modules/filing/lib/references/rewrite";
import { discover } from "@/server/modules/filing/lib/references/discovery";
import { countUsage } from "@/server/modules/filing/lib/references/usage";
import { readReport } from "@/server/modules/filing/lib/reports";
import { getStorage, invalidateStorages } from "@/server/modules/filing/lib/storage/registry";
import { buildUrl } from "@/server/modules/filing/lib/storage/urls";
import { uploadFile } from "@/server/modules/filing/file/file.service";
import * as jobs from "@/server/modules/filing/jobs/jobs.service";
import { fileReferences } from "@/config/file-references";
import { makeCategory, makeEquipment, makeServiceRequest, makeVendor } from "../auth/fixtures";
import { fake } from "./fake-s3";
import { PNG, blob, makeStorage, resetFiling, seedObject } from "./helpers";

beforeEach(resetFiling);

const REF = (table: string, column: string): FileReference => references().find((r) => r.table === table && r.column === column)!;
const done = async <T>(p: Promise<{ done: Promise<T> }>) => (await p).done;
const B = "https://s3.test/old";
const N = "https://cdn.test/new";

describe("references registry", () => {
  it("config/file-references.ts declares the project's file columns with valid identifiers", () => {
    expect(fileReferences.map((r) => `${r.table}.${r.column}:${r.type}`)).toEqual([
      "Equipment.images:url[]",
      "Product.images:url[]",
      "Category.image:url",
      "Service.image:url",
      "Training.image:url",
      "Vendor.logo:url",
      "Applicant.cvUrl:url",
      "ServiceRequest.deliveryReport:text",
    ]);
    expect(() => setReferences([{ table: 'User"; DROP TABLE x; --', column: "a", type: "url", pk: "id", label: "x" }])).toThrow(/Invalid identifier/);
  });
});

describe("rewrite (base-URL swap)", () => {
  it("url, url[] and text columns; trailing-slash safety; order of arrays kept", async () => {
    const c1 = await makeCategory();
    const c2 = await makeCategory();
    await db.category.update({ where: { id: c1.id }, data: { image: `${B}/marino/a.png` } });
    await db.category.update({ where: { id: c2.id }, data: { image: `${B}x/marino/a.png` } }); // look-alike base
    const e = await makeEquipment();
    await db.equipment.update({ where: { id: e.id }, data: { images: [`${B}/marino/1.png`, "https://elsewhere.test/2.png", `${B}/marino/3.png`] } });
    const sr = await makeServiceRequest();
    await db.serviceRequest.update({ where: { id: sr.id }, data: { deliveryReport: `See ${B}/marino/r.pdf and ${B}/marino/r2.pdf` } });

    expect(await rewriteReference(REF("Category", "image"), B, N, { dryRun: true })).toBe(1);
    expect((await db.category.findUniqueOrThrow({ where: { id: c1.id } })).image).toBe(`${B}/marino/a.png`);
    expect(await rewriteReference(REF("Category", "image"), B, N)).toBe(1);
    expect(await rewriteReference(REF("Equipment", "images"), B, N)).toBe(1);
    expect(await rewriteReference(REF("ServiceRequest", "deliveryReport"), B, N)).toBe(1);
    expect((await db.category.findUniqueOrThrow({ where: { id: c1.id } })).image).toBe(`${N}/marino/a.png`);
    expect((await db.category.findUniqueOrThrow({ where: { id: c2.id } })).image).toBe(`${B}x/marino/a.png`);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: e.id } })).images).toEqual([`${N}/marino/1.png`, "https://elsewhere.test/2.png", `${N}/marino/3.png`]);
    expect((await db.serviceRequest.findUniqueOrThrow({ where: { id: sr.id } })).deliveryReport).toBe(`See ${N}/marino/r.pdf and ${N}/marino/r2.pdf`);
    for (const r of references()) expect(await countWithBase(r, B)).toBe(0);
  });

  it("json columns, including escaped slashes; LIKE wildcards in the base are literal", async () => {
    setReferences([...fileReferences, { table: "Service", column: "content", type: "json", pk: "id", label: "Service content" }]);
    const svc = await db.service.findFirst() ?? null;
    void svc;
    const s1 = await (await import("../auth/fixtures")).makeService();
    const s2 = await (await import("../auth/fixtures")).makeService();
    await db.service.update({ where: { id: s1.id }, data: { content: [{ type: "text", body: `<img src="${B}/marino/x.png">` }] } });
    await db.$executeRawUnsafe(`UPDATE "Service" SET content = $1::jsonb WHERE id = $2`, JSON.stringify({ html: "x" }).replace("x", `${B.replace(/\//g, "\\/")}\\/marino\\/y.png`), s2.id);
    const ref = REF("Service", "content");
    expect(await rewriteReference(ref, B, N)).toBe(2);
    expect(JSON.stringify((await db.service.findUniqueOrThrow({ where: { id: s1.id } })).content)).toContain(`${N}/marino/x.png`);
    const raw = await db.$queryRawUnsafe<{ c: string }[]>(`SELECT content::text c FROM "Service" WHERE id = $1`, s2.id);
    expect(raw[0].c).toContain("cdn.test");
    // "_" and "%" in a base must not act as wildcards
    const c = await makeCategory();
    await db.category.update({ where: { id: c.id }, data: { image: "https://s3.test/oldX/marino/a.png" } });
    expect(await rewriteReference(REF("Category", "image"), "https://s3.test/old_", N)).toBe(0);
    expect(await rewriteReference(REF("Category", "image"), "https://s3.test/%", N)).toBe(0);
  });

  it("50,000 rows are rewritten in primary-key batches of 5,000", async () => {
    await db.$executeRawUnsafe(`INSERT INTO "Category" (id, name, slug, type, division, image, "order", "createdAt", "updatedAt")
      SELECT 'c' || lpad(g::text, 6, '0'), 'C' || g, 's-' || g, 'EQUIPMENT', 'EQUIPMENT', '${B}/marino/' || g || '.png', 0, now(), now() FROM generate_series(1, 50000) g`);
    expect(await rewriteReference(REF("Category", "image"), B, N, { batch: 5000 })).toBe(50000);
    expect(await countWithBase(REF("Category", "image"), B)).toBe(0);
  }, 120_000);
});

describe("discovery and usage", () => {
  it("finds undeclared columns holding storage URLs and gives a ready line; usage counts per declared column", async () => {
    await makeStorage({ bucket: "pub" });
    const s = await getStorage((await db.fileStorage.findFirstOrThrow()).id);
    const url = buildUrl(s, "marino/a.png");
    await makeVendor({ website: url, logo: url });
    const c = await makeCategory();
    await db.category.update({ where: { id: c.id }, data: { image: url } });
    const r = await discover([`https://s3.test/pub`]);
    expect(r.findings).toEqual([expect.objectContaining({ table: "Vendor", column: "website", rows: 1, line: expect.stringContaining('table: "Vendor", column: "website"') })]);
    expect(await countUsage([url])).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Vendor logo", count: 1 }), expect.objectContaining({ label: "Category image", count: 1 })]));
  });
});

describe("jobs", () => {
  it("JOB-R1 one heavy job at a time; data-changing jobs are refused while a migration is unfinished", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const first = await jobs.startImport({ storageId: s.id, dryRun: true });
    await expect(jobs.startCheck({ type: "DISCOVERY", dryRun: false })).rejects.toSatisfy((e) => isFilingError(e, "FILING_JOB_IN_PROGRESS"));
    await first.done;
    const ro = await makeStorage({ bucket: "ro", readOnly: true, active: false });
    await db.file.create({ data: { key: "marino/x.png", storageId: ro.id, name: "x", mimeType: "image/png", size: 1 } });
    await expect(jobs.startCheck({ type: "NORMALIZE", dryRun: false })).rejects.toSatisfy((e) => isFilingError(e, "MIGRATION_NOT_FINISHED"));
    expect(await (await jobs.startCheck({ type: "REFERENCE_CHECK", dryRun: false })).done).not.toBeNull();
  });

  it("JOB-R2 IMPORT: dry run changes nothing; then registers objects with folder from the reference, legacyUrl and abandoned flags; idempotent", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const old = new Date(Date.now() - 3 * 86400_000);
    seedObject("pub", "marino/catalog/equipment/a.png", "a", "image/png", old);
    seedObject("pub", "marino/catalog/b.png", "bb", "image/png", old);
    seedObject("pub", "marino/_system/reports/x.json", "{}");
    seedObject("pub", "other-app/z.png");
    const e = await makeEquipment();
    await db.equipment.update({ where: { id: e.id }, data: { images: ["https://pub.s3.test/marino/catalog/equipment/a.png?v=2"] } });

    const dry = await done(jobs.startImport({ storageId: s.id, dryRun: true }));
    expect(dry!.summary).toMatchObject({ listed: 2, created: 2 });
    expect(await db.file.count()).toBe(0);

    const real = await done(jobs.startImport({ storageId: s.id, dryRun: false }));
    expect(real!.summary).toMatchObject({ listed: 2, created: 2, abandoned: 1 });
    const a = await db.file.findUniqueOrThrow({ where: { key: "marino/catalog/equipment/a.png" } });
    expect(a).toMatchObject({ folder: "equipment", legacyUrl: "https://pub.s3.test/marino/catalog/equipment/a.png", size: 1, mimeType: "image/png" });
    expect((await db.file.findUniqueOrThrow({ where: { key: "marino/catalog/b.png" } })).folder).toBe("catalog");
    const again = await done(jobs.startImport({ storageId: s.id, dryRun: false }));
    expect(again!.summary).toMatchObject({ created: 0 });
    expect(await db.file.count()).toBe(2);
    // abandoned uploads: re-checked, then deleted
    const name = (await import("@/server/modules/filing/lib/progress")).progress.latest()!.reportName!;
    expect((await jobs.deleteAbandoned({ reportName: name })).deleted).toBe(1);
    expect(fake.get("pub", "marino/catalog/b.png")).toBeNull();
    expect(fake.get("pub", "marino/catalog/equipment/a.png")).not.toBeNull();
  });

  it("JOB-R3 REFERENCE_CHECK classifies every stored URL; fixes re-verify and apply; NORMALIZE is idempotent", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const ok = await uploadFile({ file: blob(PNG, "image/png"), name: "ok.png", folder: "categories" });
    const q = await uploadFile({ file: blob(PNG, "image/png"), name: "q.png", folder: "categories" });
    const gone = await uploadFile({ file: blob(PNG, "image/png"), name: "gone.png", folder: "categories" });
    const variant = await uploadFile({ file: blob(PNG, "image/png"), name: "v.png", folder: "equipment" });
    seedObject("pub", "marino/unreg.png");
    fake.buckets.get("pub")!.objects.delete(gone.key);
    const cats = await Promise.all([1, 2, 3, 4, 5].map(() => makeCategory()));
    const set = (i: number, image: string) => db.category.update({ where: { id: cats[i].id }, data: { image } });
    await set(0, ok.url);
    await set(1, `${q.url}?X-Amz-Signature=abc`);
    await set(2, gone.url);
    await set(3, "https://s3.test/pub/marino/unreg.png");
    await set(4, "https://images.example.com/outside.png");
    const e = await makeEquipment();
    await db.equipment.update({ where: { id: e.id }, data: { images: [`https://pub.s3.test/${variant.key}`] } });
    void s;

    const rc = (await done(jobs.startCheck({ type: "REFERENCE_CHECK", dryRun: false })))!;
    expect(rc.summary).toMatchObject({ ok: 1, query: 1, missing: 1, unregistered: 1, nonCanonical: 1, external: 1 });
    const name = (await import("@/server/modules/filing/lib/progress")).progress.latest()!.reportName!;
    expect((await readReport<{ type: string }>(name))!.type).toBe("REFERENCE_CHECK");

    const fixes = (await done(jobs.startReferenceFixes({ reportName: name, categories: ["query", "nonCanonical", "missing", "unregistered"], dryRun: false })))!;
    expect(fixes.summary).toMatchObject({ query: 1, nonCanonical: 1, missing: 1, unregistered: 1, failed: 0 });
    expect((await db.category.findUniqueOrThrow({ where: { id: cats[1].id } })).image).toBe(q.url);
    expect((await db.category.findUniqueOrThrow({ where: { id: cats[2].id } })).image).toBeNull();
    expect((await db.equipment.findUniqueOrThrow({ where: { id: e.id } })).images).toEqual([variant.url]);
    expect(await db.file.findUnique({ where: { key: "marino/unreg.png" } })).not.toBeNull();

    const after = (await done(jobs.startCheck({ type: "REFERENCE_CHECK", dryRun: false })))!;
    expect(after.summary).toMatchObject({ ok: 4, query: 0, missing: 0, unregistered: 0, nonCanonical: 0, external: 1 });

    // NORMALIZE: a base variant and a legacy value → canonical; second run changes nothing
    await db.equipment.update({ where: { id: e.id }, data: { images: [`https://pub.s3.test/${variant.key}`] } });
    await db.file.update({ where: { id: ok.id }, data: { legacyUrl: "https://legacy.example/ok.png" } });
    await set(4, "https://legacy.example/ok.png");
    const dryN = (await done(jobs.startCheck({ type: "NORMALIZE", dryRun: true })))!;
    expect((dryN.summary as { baseRewrites: number }).baseRewrites).toBe(1);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: e.id } })).images).toEqual([`https://pub.s3.test/${variant.key}`]);
    const n1 = (await done(jobs.startCheck({ type: "NORMALIZE", dryRun: false })))!;
    expect(n1.summary).toMatchObject({ baseRewrites: 1, valueFixes: 1 });
    expect((await db.category.findUniqueOrThrow({ where: { id: cats[4].id } })).image).toBe(ok.url);
    const n2 = (await done(jobs.startCheck({ type: "NORMALIZE", dryRun: false })))!;
    expect(n2.summary).toMatchObject({ baseRewrites: 0, valueFixes: 0 });
  });

  it("JOB-R3 STORAGE_CHECK: orphans, missing, size mismatch; fixes re-verified", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const a = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const b = await uploadFile({ file: blob(PNG, "image/png"), name: "b.png", folder: "equipment" });
    seedObject("pub", "marino/orphan.png");
    fake.buckets.get("pub")!.objects.delete(a.key);
    fake.put("pub", b.key, Buffer.concat([PNG, Buffer.from("more")]), "image/png");
    const r = (await done(jobs.startCheck({ type: "STORAGE_CHECK", storageId: s.id, dryRun: false })))!;
    expect(r.summary).toMatchObject({ objects: 2, rows: 2, orphans: 1, missing: 1, sizeMismatch: 1 });
    const name = (await import("@/server/modules/filing/lib/progress")).progress.latest()!.reportName!;
    const f = (await done(jobs.startStorageFixes({ reportName: name, markMissing: true, fixSizes: true, dryRun: false })))!;
    expect(f.summary).toMatchObject({ markedDeleted: 1, sizesFixed: 1 });
    expect((await db.file.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DELETED");
    expect((await db.file.findUniqueOrThrow({ where: { id: b.id } })).size).toBe(PNG.length + 4);
  });

  it("BASE_URL_CHANGE: tested against the new base, saved, every stored URL swapped (dry run changes nothing)", async () => {
    const s = await makeStorage({ bucket: "pub" });
    fake.cdn.set("https://cdn.test", "pub");
    const f = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "categories" });
    const c = await makeCategory();
    await db.category.update({ where: { id: c.id }, data: { image: f.url } });
    const dry = (await done(jobs.startBaseUrlChange({ storageId: s.id, publicBaseUrl: "https://cdn.test", dryRun: true })))!;
    expect(dry.summary).toMatchObject({ rows: 1 });
    expect((await db.category.findUniqueOrThrow({ where: { id: c.id } })).image).toBe(f.url);
    const real = (await done(jobs.startBaseUrlChange({ storageId: s.id, publicBaseUrl: "https://cdn.test", dryRun: false })))!;
    expect(real.summary).toMatchObject({ rows: 1, remaining: 0 });
    invalidateStorages();
    expect((await db.category.findUniqueOrThrow({ where: { id: c.id } })).image).toBe(`https://cdn.test/${f.key}`);
    // An address that does not serve the bucket fails the test and changes nothing
    const fail = await done(jobs.startBaseUrlChange({ storageId: s.id, publicBaseUrl: "https://nowhere.test", dryRun: false }));
    expect(fail).toBeNull();
    expect((await db.fileStorage.findUniqueOrThrow({ where: { id: s.id } })).publicBaseUrl).toBe("https://cdn.test");
  });
});
