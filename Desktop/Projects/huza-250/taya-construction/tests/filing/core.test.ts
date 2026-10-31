// Filing core (guide §19): crypto, URLs, folder rules, storage test, storages, settings.
import "./mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/validation/db";
import { decrypt, encrypt, needsReencrypt } from "@/server/modules/filing/lib/crypto";
import { isFilingError } from "@/server/modules/filing/lib/errors";
import { normalizeFolder, ruleFor } from "@/server/modules/filing/lib/folder";
import { rotateStorageSecrets } from "@/server/modules/filing/lib/rotate";
import { getStorage, invalidateStorages } from "@/server/modules/filing/lib/storage/registry";
import { testStorage } from "@/server/modules/filing/lib/storage/test";
import { baseVariants, buildUrl, canonicalBase, cleanUrl, encodeKey, isOwnKey, parseUrl, parseWith } from "@/server/modules/filing/lib/storage/urls";
import { activateStorage, createStorage, deleteStorage, listStorages, updateStorage } from "@/server/modules/filing/file-storage/file-storage.service";
import { readSettings, updateSettings } from "@/server/modules/filing/file-settings/file-settings.service";
import { updateSettingsSchema } from "@/server/modules/filing/file-settings/file-settings.schema";
import { uploadFile } from "@/server/modules/filing/file/file.service";
import { fake } from "./fake-s3";
import { KEY, OLD_KEY, PNG, blob, makeStorage, resetFiling } from "./helpers";

beforeEach(resetFiling);

describe("crypto", () => {
  it("round trip; the stored form never contains the secret", () => {
    const c = encrypt("super-secret-value");
    expect(c.startsWith("k1:")).toBe(true);
    expect(c).not.toContain("super-secret");
    expect(decrypt(c)).toBe("super-secret-value");
  });

  it("the previous key still decrypts; rotation re-encrypts with the current key", async () => {
    process.env.FILING_ENCRYPTION_KEY = OLD_KEY;
    process.env.FILING_ENCRYPTION_KEY_ID = "k0";
    const s = await makeStorage({ bucket: "rot" });
    expect(s.secretAccessKey.startsWith("k0:")).toBe(true);
    process.env.FILING_ENCRYPTION_KEY = KEY;
    process.env.FILING_ENCRYPTION_KEY_ID = "k1";
    process.env.FILING_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    process.env.FILING_ENCRYPTION_KEY_PREVIOUS_ID = "k0";
    expect(decrypt(s.secretAccessKey)).toBe("test-secret");
    expect(needsReencrypt(s.secretAccessKey)).toBe(true);
    const dry = await rotateStorageSecrets({ dryRun: true });
    expect(dry.changed).toHaveLength(1);
    expect((await db.fileStorage.findUniqueOrThrow({ where: { id: s.id } })).secretAccessKey.startsWith("k0:")).toBe(true);
    await rotateStorageSecrets({ dryRun: false });
    const after = await db.fileStorage.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.secretAccessKey.startsWith("k1:")).toBe(true);
    delete process.env.FILING_ENCRYPTION_KEY_PREVIOUS;
    expect(decrypt(after.secretAccessKey)).toBe("test-secret");
  });

  it("a missing or short key fails with ENCRYPTION_KEY_INVALID", () => {
    process.env.FILING_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});

describe("URLs", () => {
  const aws = { publicBaseUrl: null, endpoint: null, bucket: "kigalijob", region: "eu-north-1", forcePathStyle: false, prefix: "marino-cons" };

  it("canonical AWS URL reproduces the format the app stored before", () => {
    expect(canonicalBase(aws)).toBe("https://kigalijob.s3.eu-north-1.amazonaws.com");
    expect(buildUrl(aws, "marino-cons/2026/10/a b.png")).toBe("https://kigalijob.s3.eu-north-1.amazonaws.com/marino-cons/2026/10/a%20b.png");
  });

  it("parseWith reads every base variant, encoded keys and query strings; foreign prefixes and URLs are not own", () => {
    const key = "marino-cons/2026/10/x y.png";
    for (const b of baseVariants(aws)) expect(parseWith(aws, cleanUrl(`${b}/${encodeKey(key)}?v=2#top`))).toBe(key);
    expect(parseWith(aws, "https://kigalijob.s3.eu-north-1.amazonaws.com/other-app/x.png")).toBeNull();
    expect(parseWith(aws, "https://lh3.googleusercontent.com/a.png")).toBeNull();
    expect(parseWith({ ...aws, publicBaseUrl: "https://cdn.marino.rw/" }, "https://cdn.marino.rw/marino-cons/a.png")).toBe("marino-cons/a.png");
  });

  it("parseUrl checks every registered storage; isOwnKey skips _system and _backups", async () => {
    const s = await makeStorage({ bucket: "pub" });
    const p = await parseUrl(`https://s3.test/pub/marino/2026/10/a.png?X-Amz-Signature=1`);
    expect(p?.storage.id).toBe(s.id);
    expect(p?.key).toBe("marino/2026/10/a.png");
    expect(await parseUrl("https://s3.test/pubx/marino/a.png")).toBeNull(); // trailing "/" safety
    expect(isOwnKey(s, "marino/_backups/a.zip")).toBe(false);
    expect(isOwnKey(s, "marino/_system/r.json")).toBe(false);
    expect(isOwnKey(s, "elsewhere/a.png")).toBe(false);
  });
});

describe("folders", () => {
  it("normalizes and inherits rules from the nearest parent", () => {
    expect(normalizeFolder(" /Site Photos//2026/ ")).toBe("site-photos/2026");
    const rules = { cvs: { maxMb: 5, access: "PRIVATE" as const }, "cvs/archive": { maxMb: 2 } };
    expect(ruleFor("cvs/2026", rules)?.access).toBe("PRIVATE");
    expect(ruleFor("cvs/archive/x", rules)?.maxMb).toBe(2);
    expect(ruleFor("other", rules)).toBeNull();
  });
});

describe("storage test", () => {
  it("passes on a healthy public storage and cleans up", async () => {
    const s = await getStorage((await makeStorage({ bucket: "ok" })).id);
    const r = await testStorage(s);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.ok).toBe(true);
    expect([...fake.buckets.get("ok")!.objects.keys()]).toEqual([]);
  });

  it("fails for an exposed private storage, missing CORS, bad credentials and clock skew", async () => {
    const priv = await getStorage((await makeStorage({ bucket: "leaky", access: "PRIVATE", publicRead: true })).id);
    const r1 = await testStorage(priv);
    expect(r1.ok).toBe(false);
    expect(r1.checks.find((c) => c.name.startsWith("Anonymous read"))?.ok).toBe(false);

    const nocors = await getStorage((await makeStorage({ bucket: "nocors", cors: false })).id);
    const r2 = await testStorage(nocors);
    expect(r2.checks.find((c) => c.name.startsWith("CORS"))).toMatchObject({ ok: false, hint: expect.stringContaining("AllowedMethods") });

    const okS = await getStorage((await makeStorage({ bucket: "skew" })).id);
    fake.clockSkewMs = 10 * 60 * 1000;
    expect((await testStorage(okS)).checks.find((c) => c.name === "Presigned GET")?.ok).toBe(false);
    fake.clockSkewMs = 0;

    const bad = { ...okS, client: new (await import("./fake-s3")).FakeS3Client({ credentials: { accessKeyId: "bad-key", secretAccessKey: "x" } }) } as never;
    const r3 = await testStorage(bad);
    expect(r3.ok).toBe(false);
    expect(r3.checks[0]).toMatchObject({ name: "Put", ok: false });
  });

  it("a publicly readable _backups/ is a warning, not a failure", async () => {
    const s = await getStorage((await makeStorage({ bucket: "allpublic", publicRead: true })).id);
    const r = await testStorage(s);
    expect(r.checks.find((c) => c.name === "Backups not public")).toMatchObject({ ok: false, warning: true });
    expect(r.ok).toBe(true);
  });
});

describe("storages", () => {
  const input = { name: "R2", endpoint: "https://s3.test", region: "auto", bucket: "newb", prefix: "marino", forcePathStyle: true, accessKeyId: "AKIAEXAMPLE1234", secretAccessKey: "very-secret-key", publicBaseUrl: null, access: "PUBLIC" as const };

  it("STO-R1 the secret is encrypted, never returned; the access key id is masked", async () => {
    fake.bucket("newb", { publicRead: (k) => !k.includes("/_backups/") });
    const { storage, test } = await createStorage(input);
    expect(test.ok).toBe(true);
    expect(storage.isActive).toBe(false);
    expect(JSON.stringify(storage)).not.toContain("very-secret-key");
    expect(storage).not.toHaveProperty("secretAccessKey");
    expect(storage.accessKeyId).toBe("AKIA••••1234");
    const row = await db.fileStorage.findUniqueOrThrow({ where: { id: storage.id } });
    expect(row.secretAccessKey).not.toContain("very-secret-key");
    expect(decrypt(row.secretAccessKey)).toBe("very-secret-key");
    expect(JSON.stringify(await listStorages())).not.toContain("very-secret-key");
  });

  it("STO-R2 locked fields are rejected once the storage has files; name and secret may change", async () => {
    const s = await makeStorage({ bucket: "locked" });
    await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    await expect(updateStorage({ id: s.id, bucket: "other", secretAccessKey: undefined })).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_LOCKED_FIELDS"));
    await expect(updateStorage({ id: s.id, prefix: "x", secretAccessKey: undefined })).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_LOCKED_FIELDS"));
    const r = await updateStorage({ id: s.id, name: "Renamed", secretAccessKey: "new-secret-123" });
    expect(r.storage.name).toBe("Renamed");
    expect(decrypt((await db.fileStorage.findUniqueOrThrow({ where: { id: s.id } })).secretAccessKey)).toBe("new-secret-123");
  });

  it("STO-R3 one active storage per access; switching away from a storage with files needs a migration", async () => {
    const a = await makeStorage({ bucket: "a" });
    const b = await makeStorage({ bucket: "b", active: false });
    const p = await makeStorage({ bucket: "p", access: "PRIVATE" });
    await activateStorage(b.id); // a has no files: allowed
    invalidateStorages();
    const rows = await db.fileStorage.findMany({ where: { isActive: true }, select: { id: true } });
    expect(rows.map((r) => r.id).sort()).toEqual([b.id, p.id].sort());
    await uploadFile({ file: blob(PNG, "image/png"), name: "a.png", folder: "equipment" });
    await expect(activateStorage(a.id)).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_IN_USE"));
    const failing = await makeStorage({ bucket: "c", active: false, cors: false });
    await expect(activateStorage(failing.id)).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_TEST_FAILED"));
  });

  it("STO-R4 delete only with no files and no backups, and the typed name", async () => {
    const a = await makeStorage({ bucket: "del" });
    await expect(deleteStorage(a.id, "wrong")).rejects.toThrow(/Type the storage name/);
    await db.fileBackup.create({ data: { type: "FULL", toDate: new Date(), status: "COMPLETED", storageId: a.id } });
    await expect(deleteStorage(a.id, a.name)).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_IN_USE"));
    await db.fileBackup.deleteMany();
    await deleteStorage(a.id, a.name);
    expect(await db.fileStorage.count()).toBe(0);
  });

  it("STO-R5 publicBaseUrl is not editable in the storage form (only the base-URL change job)", () => {
    // The update schema has no publicBaseUrl field: strictObject refuses it.
    return import("@/server/modules/filing/file-storage/file-storage.schema").then(({ updateStorageSchema }) => {
      expect(updateStorageSchema.safeParse({ id: "x", publicBaseUrl: "https://cdn.test" }).success).toBe(false);
    });
  });
});

describe("settings", () => {
  it("SET-R1 defaults are created on first read; folder rules replace the global type list for that folder", async () => {
    const s = await readSettings();
    expect(s.maxUploadMb).toBe(20);
    expect(s.folderRules?.cvs).toMatchObject({ access: "PRIVATE" });
    const input = updateSettingsSchema.parse({ maxUploadMb: 10, presignExpirySec: 120, allowedMimeTypes: ["image/png"], folderRules: { logos: { mimeTypes: ["image/svg+xml"], maxMb: 1 } } });
    const saved = await updateSettings(input);
    expect(saved.folderRules).toEqual({ logos: { mimeTypes: ["image/svg+xml"], maxMb: 1 } });
    expect(updateSettingsSchema.safeParse({ ...input, folderRules: { "Bad Folder": {} } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ ...input, presignExpirySec: 5 }).success).toBe(false);
  });

  it("SET-R2 a PRIVATE folder without an active private storage refuses uploads (STORAGE_NOT_CONFIGURED)", async () => {
    await makeStorage({ bucket: "only-public" });
    await expect(uploadFile({ file: blob(Buffer.from("%PDF-1.4"), "application/pdf"), name: "cv.pdf", folder: "cvs" })).rejects.toSatisfy((e) => isFilingError(e, "STORAGE_NOT_CONFIGURED"));
  });
});
