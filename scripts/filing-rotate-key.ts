// FILING KEY ROTATION (guide §4.1): re-encrypts every FileStorage secret with
// the current FILING_ENCRYPTION_KEY. Steps:
//   1. Move the old key to FILING_ENCRYPTION_KEY_PREVIOUS (+ _PREVIOUS_ID).
//   2. Set the new FILING_ENCRYPTION_KEY with a new FILING_ENCRYPTION_KEY_ID.
//   3. Deploy, then run:   npm run filing:rotate-key   (add -- --dry-run to preview)
//   4. Remove FILING_ENCRYPTION_KEY_PREVIOUS from every instance.

import { db } from "../src/server/validation/db";
import { rotateStorageSecrets } from "../src/server/modules/filing/lib/rotate";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { total, changed } = await rotateStorageSecrets({ dryRun });
  for (const name of changed) console.log(`${dryRun ? "Would re-encrypt" : "Re-encrypted"} "${name}".`);
  console.log(`${changed.length} of ${total} storage secret(s) ${dryRun ? "need" : "were"} re-encrypted.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
