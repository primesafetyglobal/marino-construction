// AUTH CLEANUP (daily, 03:00 Africa/Kigali; scheduled by the host's cron):
// - deletes used or expired auth tokens older than 30 days
// - deletes auth events older than 12 months
// Bounded per run and safe to run twice (a second run finds nothing).
//
//   npm run auth:cleanup

import { db } from "../src/server/validation/db";
import { ACCESS_CONFIG } from "../src/server/modules/access/access.config";

async function main() {
  const { tokensOlderThanDays, eventsOlderThanMonths, batch } = ACCESS_CONFIG.cleanup;
  const tokenCutoff = new Date(Date.now() - tokensOlderThanDays * 24 * 60 * 60 * 1000);
  const eventCutoff = new Date();
  eventCutoff.setUTCMonth(eventCutoff.getUTCMonth() - eventsOlderThanMonths);

  const tokens = await db.authToken.findMany({
    where: { OR: [{ usedAt: { lt: tokenCutoff } }, { expiresAt: { lt: tokenCutoff } }] },
    select: { id: true },
    take: batch,
  });
  const deletedTokens = await db.authToken.deleteMany({ where: { id: { in: tokens.map((t) => t.id) } } });

  const events = await db.authEvent.findMany({ where: { createdAt: { lt: eventCutoff } }, select: { id: true }, take: batch });
  const deletedEvents = await db.authEvent.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });

  console.log(`auth cleanup: ${deletedTokens.count} tokens, ${deletedEvents.count} events deleted.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error("Auth cleanup failed:", err);
    await db.$disconnect();
    process.exit(1);
  });
