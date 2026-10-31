// FILING BOOTSTRAP (guide §6.2): seeds the first FileStorage when the table is
// empty, activates it, runs the storage test and creates the settings row.
// No-op when a storage exists. Reads FILING_BOOTSTRAP_*, falling back to the
// app's S3_* variables (deviation: no secret is copied into a new variable).
// Optional FILING_BOOTSTRAP_PRIVATE_PREFIX adds a PRIVATE storage on the same
// bucket (CVs, delivery reports), for buckets that block public access on
// that prefix. Run on the server only, once:
//
//   npm run filing:bootstrap            (add -- --skip-test to skip the test)

import { db } from "../src/server/validation/db";
import { encrypt } from "../src/server/modules/filing/lib/crypto";
import { getSettings } from "../src/server/modules/filing/lib/settings";
import { getStorage, invalidateStorages } from "../src/server/modules/filing/lib/storage/registry";
import { testStorage } from "../src/server/modules/filing/lib/storage/test";

const env = (name: string, fallback?: string) => process.env[`FILING_BOOTSTRAP_${name}`]?.trim() || (fallback ? process.env[fallback]?.trim() : "") || "";

const PREFIX = /^[a-z0-9-]+$/;

async function main() {
  const existing = await db.fileStorage.count();
  if (existing > 0) {
    console.log(`Filing bootstrap: ${existing} storage(s) already exist, nothing to do.`);
    await getSettings();
    return;
  }
  const base = {
    endpoint: env("ENDPOINT", "S3_ENDPOINT") || null,
    region: env("REGION", "S3_REGION") || "auto",
    bucket: env("BUCKET", "S3_BUCKET"),
    forcePathStyle: env("FORCE_PATH_STYLE") === "true",
    accessKeyId: env("ACCESS_KEY_ID", "S3_ACCESS_KEY_ID"),
    secret: env("SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY"),
    publicBaseUrl: env("PUBLIC_BASE_URL", "S3_PUBLIC_URL") || null,
  };
  const prefix = env("PREFIX", "S3_UPLOAD_FOLDER") || "marino";
  const access = env("ACCESS") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const privatePrefix = env("PRIVATE_PREFIX");
  if (!base.bucket || !base.accessKeyId || !base.secret) throw new Error("Set FILING_BOOTSTRAP_BUCKET, _ACCESS_KEY_ID and _SECRET_ACCESS_KEY (or the S3_* variables).");
  for (const p of [prefix, privatePrefix].filter(Boolean)) if (!PREFIX.test(p)) throw new Error(`Invalid prefix "${p}" (lowercase letters, digits and "-").`);
  if (privatePrefix && privatePrefix === prefix) throw new Error("FILING_BOOTSTRAP_PRIVATE_PREFIX must differ from the public prefix.");

  const rows = [{ name: env("NAME") || "AWS S3", prefix, access, publicBaseUrl: base.publicBaseUrl }];
  if (privatePrefix) rows.push({ name: `${env("NAME") || "AWS S3"} (private)`, prefix: privatePrefix, access: "PRIVATE", publicBaseUrl: null });

  const created = await db.$transaction(
    rows.map((r) =>
      db.fileStorage.create({
        data: {
          name: r.name,
          endpoint: base.endpoint,
          region: base.region,
          bucket: base.bucket,
          prefix: r.prefix,
          forcePathStyle: base.forcePathStyle,
          accessKeyId: base.accessKeyId,
          secretAccessKey: encrypt(base.secret),
          publicBaseUrl: r.publicBaseUrl,
          access: r.access as "PUBLIC" | "PRIVATE",
          isActive: true,
        },
        select: { id: true, name: true, access: true, prefix: true },
      }),
    ),
  );
  invalidateStorages();
  await getSettings();
  for (const c of created) console.log(`Created and activated storage "${c.name}" (${c.access}, prefix ${c.prefix}).`);
  if (process.argv.includes("--skip-test")) return;
  for (const c of created) {
    const report = await testStorage(await getStorage(c.id), { skipNetwork: false });
    console.log(`\nTest of "${c.name}": ${report.ok ? "passed" : "FAILED"}`);
    for (const ch of report.checks) console.log(`  ${ch.ok ? "ok  " : "FAIL"} ${ch.name}${ch.detail ? ` (${ch.detail})` : ""}${!ch.ok && ch.hint ? `\n       hint: ${ch.hint}` : ""}`);
  }
  console.log("\nRemove the FILING_BOOTSTRAP_* credentials from the environment: the database is now the source of truth.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
