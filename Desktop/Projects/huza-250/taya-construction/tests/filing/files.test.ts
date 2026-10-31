// Filing files (guide §19 "Files") and the one-door call sites.
import "./mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/validation/db";
import { isFilingError } from "@/server/modules/filing/lib/errors";
import { updateSettings } from "@/server/modules/filing/file-settings/file-settings.service";
import { updateSettingsSchema } from "@/server/modules/filing/file-settings/file-settings.schema";
import {
  confirmUpload,
  deleteByUrl,
  deleteFiles,
  getAccessUrl,
  getAccessUrls,
  getFileByUrl,
  listFiles,
  listFolders,
  moveFiles,
  newKey,
  renameFolder,
  replaceFile,
  requestUpload,
  uploadFile,
} from "@/server/modules/filing/file/file.service";
import { listFilesSchema } from "@/server/modules/filing/file/file.schema";
import { createUploadTicket as catalogTicket, resolveImage } from "@/server/modules/catalog/catalog.files";
import { createUploadTicket as partiesTicket, fileLink, resolveUpload } from "@/server/modules/parties/parties.files";
import { createReportUploadTicket, isPrivateFile, privateLink, resolveReport } from "@/server/modules/operations/operations.files";
import { fake, fakeFetch } from "./fake-s3";
import { JPG, PDF, PNG, blob, browserUpload, makeStorage, resetFiling, seedObject } from "./helpers";

beforeEach(resetFiling);

const both = async () => ({ pub: await makeStorage({ bucket: "pub" }), priv: await makeStorage({ bucket: "priv", access: "PRIVATE", prefix: "marino-private" }) });

describe("keys and policy", () => {
  it("FIL-R1 keys are {prefix}/{yyyy}/{mm}/{uuid}-{safe-name}.{ext}", () => {
    const k = newKey({ prefix: "marino" }, "Rapport Été 2026 (final).PDF", new Date(Date.UTC(2026, 9, 5)));
    expect(k).toMatch(/^marino\/2026\/10\/[0-9a-f-]{36}-rapport-ete-2026-final\.pdf$/);
    expect(newKey({ prefix: "p" }, ".....")).toMatch(/-file$/);
  });

  it("FIL-R2 folder rules (inherited) decide type, size and storage; PRIVATE folders go to the private storage", async () => {
    const { priv } = await both();
    await expect(uploadFile({ file: blob(PDF, "application/pdf"), name: "a.pdf", folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_TYPE_NOT_ALLOWED"));
    await expect(requestUpload({ name: "big.png", mimeType: "image/png", size: 9 * 1024 * 1024, folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_TOO_LARGE"));
    const cv = await uploadFile({ file: blob(PDF, "application/pdf"), name: "cv.pdf", folder: "cvs/2026" }); // inherits cvs
    expect(cv.storageId).toBe(priv.id);
    expect(cv.access).toBe("PRIVATE");
    expect(fake.get("priv", cv.key)?.cacheControl).toBe("private, no-store");
    const img = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    expect(img.url).toBe(`https://s3.test/pub/${img.key}`);
    expect(fake.get("pub", img.key)?.cacheControl).toContain("immutable");
    // Global cap wins over a larger folder rule.
    await updateSettings(updateSettingsSchema.parse({ maxUploadMb: 1, presignExpirySec: 300, allowedMimeTypes: ["image/png"], folderRules: { equipment: { maxMb: 8 } } }));
    await expect(requestUpload({ name: "b.png", mimeType: "image/png", size: 2 * 1024 * 1024, folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_TOO_LARGE"));
  });
});

describe("uploads", () => {
  it("FIL-R3 server uploads check magic bytes; a failed DB write removes the object", async () => {
    await makeStorage({ bucket: "pub" });
    await expect(uploadFile({ file: blob(Buffer.from("not a png"), "image/png"), name: "x.png", folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_CONTENT_MISMATCH"));
    const spy = vi.spyOn(db.file, "create").mockRejectedValueOnce(new Error("db down"));
    await expect(uploadFile({ file: blob(JPG, "image/jpeg"), name: "x.jpg", folder: "equipment" })).rejects.toThrow("db down");
    spy.mockRestore();
    expect(fake.buckets.get("pub")!.objects.size).toBe(0);
  });

  it("FIL-R4 presigned flow: idempotent confirm, wrong key or storage rejected, real type and size re-checked", async () => {
    const { pub, priv } = await both();
    const { ticket, file } = await browserUpload("photo.png", "image/png", PNG, "equipment");
    expect(file.size).toBe(PNG.length);
    expect(ticket.uploadUrl).toContain("X-Amz-Expires=300");
    const again = await confirmUpload({ key: ticket.key, storageId: ticket.storageId, name: "photo.png", folder: "equipment" });
    expect(again.id).toBe(file.id);
    expect(await db.file.count()).toBe(1);
    // Not uploaded / foreign key / other storage
    const t2 = await requestUpload({ name: "b.png", mimeType: "image/png", size: 10, folder: "equipment" });
    await expect(confirmUpload({ key: t2.key, storageId: t2.storageId, name: "b.png", folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_NOT_IN_STORAGE"));
    await expect(confirmUpload({ key: "someone-else/x.png", storageId: pub.id, name: "x.png" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_KEY_INVALID"));
    await expect(confirmUpload({ key: "marino/_system/reports/x.json", storageId: pub.id, name: "x" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_KEY_INVALID"));
    const t3 = await requestUpload({ name: "c.png", mimeType: "image/png", size: PNG.length, folder: "equipment" });
    await fakeFetch(t3.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: PNG });
    await expect(confirmUpload({ key: t3.key, storageId: priv.id, name: "c.png", folder: "equipment" })).rejects.toSatisfy((e) => isFilingError(e, "FILE_KEY_INVALID"));
    // The browser sent another type than requested: refused and removed.
    await expect(browserUpload("evil.png", "image/png", PDF, "equipment", "application/pdf")).rejects.toSatisfy((e) => isFilingError(e, "FILE_TYPE_NOT_ALLOWED"));
    expect([...fake.buckets.get("pub")!.objects.keys()].some((k) => k.endsWith("evil.png"))).toBe(false);
  });

  it("FIL-R5 any stored format resolves to the file: base variants, query strings, legacyUrl", async () => {
    await makeStorage({ bucket: "pub" });
    const f = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    expect((await getFileByUrl(`${f.url}?v=3`))?.id).toBe(f.id);
    expect((await getFileByUrl(`https://pub.s3.test/${f.key}`))?.id).toBe(f.id);
    await db.file.update({ where: { id: f.id }, data: { legacyUrl: "https://old-cdn.example/a.png" } });
    expect((await getFileByUrl("https://old-cdn.example/a.png?x=1"))?.id).toBe(f.id);
    expect(await getFileByUrl("https://lh3.googleusercontent.com/a.png")).toBeNull();
  });
});

describe("access", () => {
  it("FIL-R6 getAccessUrl: public → URL, private → cached presigned, external → unchanged, deleted → null", async () => {
    await both();
    const img = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const cv = await uploadFile({ file: blob(PDF, "application/pdf"), name: "cv.pdf", folder: "cvs" });
    expect(await getAccessUrl(img.url)).toBe(img.url);
    const link = await getAccessUrl(cv.url);
    expect(link).toMatch(/^https:\/\/signed\.s3\.test\/priv\/.+X-Amz-Signature=/);
    expect(await getAccessUrl(cv.url)).toBe(link); // LRU reuse
    expect((await fakeFetch(link!)).status).toBe(200);
    expect((await fakeFetch(cv.url)).status).toBe(403); // never readable by URL
    expect(await getAccessUrl(cv.url, { download: true })).toContain("response-content-disposition=attachment");
    expect(await getAccessUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(await getAccessUrls([img.url, null, cv.url, "https://example.com/y"])).toEqual([img.url, null, link, "https://example.com/y"]);
    await deleteFiles([cv.id]);
    expect(await getAccessUrl(cv.url)).toBeNull();
    // presigned URLs are never stored
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int n FROM "File" WHERE "legacyUrl" LIKE '%X-Amz%'`);
    expect(rows[0].n).toBe(0);
  });
});

describe("delete", () => {
  it("FIL-R7 storage first; a failed storage delete keeps the row ACTIVE (partial failure)", async () => {
    await makeStorage({ bucket: "pub" });
    const a = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const b = await uploadFile({ file: blob(PNG, "image/png"), name: "b.png", folder: "equipment" });
    fake.failDelete.add(b.key);
    const r = await deleteFiles([a.id, b.id]);
    expect(r.deleted).toBe(1);
    expect(r.failed).toEqual([{ id: b.id, reason: expect.stringContaining("Delete failed") }]);
    expect((await db.file.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DELETED");
    expect((await db.file.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("ACTIVE");
    expect(fake.get("pub", a.key)).toBeNull();
    expect(fake.get("pub", b.key)).not.toBeNull();
  });

  it("FIL-R9 deleteByUrl never throws for external URLs; removes own unregistered (legacy) objects; replaceFile", async () => {
    await makeStorage({ bucket: "pub" });
    expect(await deleteByUrl("https://lh3.googleusercontent.com/me.png")).toEqual({ deleted: 0, failed: [] });
    expect(await deleteByUrl(null)).toEqual({ deleted: 0, failed: [] });
    seedObject("pub", "marino/catalog/old.png");
    expect((await deleteByUrl("https://s3.test/pub/marino/catalog/old.png")).deleted).toBe(1);
    expect(fake.get("pub", "marino/catalog/old.png")).toBeNull();
    const first = await uploadFile({ file: blob(PNG, "image/png"), name: "logo.png", folder: "vendor-logos" });
    const second = await replaceFile(first.url, { file: blob(PNG, "image/png"), name: "logo2.png", folder: "vendor-logos" });
    expect(second.id).not.toBe(first.id);
    expect((await db.file.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("DELETED");
  });
});

describe("organize", () => {
  it("FIL-R8 moves are refused when the target rule does not fit (type, size, access)", async () => {
    await both();
    const img = await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    const cv = await uploadFile({ file: blob(PDF, "application/pdf"), name: "cv.pdf", folder: "cvs" });
    await expect(moveFiles([img.id], "cvs")).rejects.toSatisfy((e) => isFilingError(e, "FILE_MOVE_NOT_ALLOWED"));
    await expect(moveFiles([cv.id], null)).rejects.toSatisfy((e) => isFilingError(e, "FILE_MOVE_NOT_ALLOWED")); // private file into a public folder
    expect((await moveFiles([img.id], "products")).moved).toBe(1);
    expect((await moveFiles([cv.id], "cvs/archive")).moved).toBe(1);
  });

  it("renameFolder renames sub-folders too, and not look-alike folders", async () => {
    await makeStorage({ bucket: "pub" });
    for (const folder of ["site", "site/2026", "site/2026/june", "sites"]) await db.file.create({ data: { key: `marino/k-${folder}`, storageId: (await db.fileStorage.findFirstOrThrow()).id, name: "x", mimeType: "image/png", size: 1, folder } });
    expect((await renameFolder("site", "photos")).renamed).toBe(3);
    const folders = (await listFolders()).map((f) => f.folder).sort();
    expect(folders).toEqual(["photos", "photos/2026", "photos/2026/june", "sites"]);
    const page = await listFiles(listFilesSchema.parse({ folder: "photos" }));
    expect(page.items).toHaveLength(3);
    expect(page.items[0].url).toMatch(/^https:\/\/s3\.test\/pub\//);
  });
});

describe("one door: module upload tickets go through Filing", () => {
  it("catalog: ticket → browser PUT → resolveImage stores the Filing url (registered, folder set); tampering fails", async () => {
    await makeStorage({ bucket: "pub" });
    const t = await catalogTicket({ kind: "product", mimeType: "image/png", sizeBytes: PNG.length });
    await fakeFetch(t.uploadUrl, { method: "PUT", headers: t.headers, body: PNG });
    const url = await resolveImage(`upload:${t.uploadToken}`, "product", false);
    const f = await getFileByUrl(url);
    expect(f).toMatchObject({ folder: "products", status: "ACTIVE" });
    expect(url).toBe(f!.url);
    await expect(resolveImage(`upload:${t.uploadToken}x`, "product", false)).rejects.toThrow(/could not be verified/);
    await expect(resolveImage(`upload:${t.uploadToken}`, "equipment", false)).rejects.toThrow(/could not be verified/);
    await expect(resolveImage("https://example.com/a.png", "product", false)).rejects.toThrow(/upload the image again/);
  });

  it("parties: CVs go to the private folder, stored as the URL, opened through a presigned link", async () => {
    await both();
    const t = await partiesTicket({ kind: "cv", mimeType: "application/pdf", sizeBytes: PDF.length });
    await fakeFetch(t.uploadUrl, { method: "PUT", headers: t.headers, body: PDF });
    const stored = await resolveUpload(`upload:${t.uploadToken}`, "cv", false);
    expect(stored).toMatch(/^https:\/\/s3\.test\/priv\/marino-private\//);
    expect(await fileLink(stored, "CV.pdf")).toMatch(/signed\.s3\.test.*attachment/);
  });

  it("operations: delivery reports are private files; plain report text stays text", async () => {
    await both();
    const t = await createReportUploadTicket({ mimeType: "application/pdf", sizeBytes: PDF.length });
    await fakeFetch(t.uploadUrl, { method: "PUT", headers: t.headers, body: PDF });
    const stored = (await resolveReport(`upload:${t.uploadToken}`))!;
    expect(await isPrivateFile(stored)).toBe(true);
    expect(await privateLink(stored, "r.pdf")).toMatch(/signed\.s3\.test/);
    expect(await resolveReport("Delivered on site, all good.")).toBe("Delivered on site, all good.");
    expect(await isPrivateFile("Delivered on site, all good.")).toBe(false);
  });

  it("without an active storage, tickets answer “Uploads are not configured yet.”", async () => {
    await expect(catalogTicket({ kind: "product", mimeType: "image/png", sizeBytes: 10 })).rejects.toThrow("Uploads are not configured yet.");
  });
});
