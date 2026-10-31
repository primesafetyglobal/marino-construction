// SEED: real starting data, idempotent (upsert by slug / email).
//
//   npm run db:seed        → Super Admin (SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASS), categories, services
//   npm run db:seed:demo   → the same, plus clearly fake "Demo" records so
//                            every screen can be previewed
//
// Runs with tsx and scripts/tsconfig.scripts.json (server-only → stub, DNSA 24.1).
// Existing rows are never overwritten, so re-running is safe in production.

import { db } from "../src/server/validation/db";
import bcrypt from "bcryptjs";
import { appUrl } from "../src/server/integrations/mailer";
import { ACCESS_CONFIG } from "../src/server/modules/access/access.config";
import { CATEGORIES, SERVICES } from "./seed-content";
import { seedDemo } from "./seed-demo";

// The Super Admin comes from SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASS (bcrypt-hashed).
// An existing account keeps its password unless it has none yet (invite pending).
async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASS;
  if (!email || !password) {
    console.warn("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASS is not set: no Super Admin created.");
    return;
  }
  if (password.length < ACCESS_CONFIG.passwords.min) throw new Error(`SUPER_ADMIN_PASS must be at least ${ACCESS_CONFIG.passwords.min} characters.`);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, password: true } });
  if (existing && existing.password !== "") {
    console.log(`Super Admin ${email} already exists. Password left unchanged.`);
    return;
  }
  const hash = await bcrypt.hash(password, ACCESS_CONFIG.passwords.bcryptCost);
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { password: hash, role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }, select: { id: true } })
    : await db.user.create({ data: { name: "Super Admin", email, role: "SUPER_ADMIN", password: hash, mustChangePassword: false, isActive: true }, select: { id: true } });
  await db.authToken.updateMany({ where: { userId: user.id, type: "INVITE", usedAt: null }, data: { usedAt: new Date() } });
  await db.authEvent.create({ data: { type: "USER_UPDATED", userId: user.id, metadata: { by: "seed", role: "SUPER_ADMIN" }, createdAt: new Date() } });
  console.log(`Super Admin ${email} ready. Sign in at ${appUrl("/login")}.`);
}

async function seedCatalog() {
  let order = 0;
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, type: c.type, division: c.division, description: c.description ?? null, order: order++ },
      update: {},
    });
  }
  const categoryIds = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  let serviceOrder = 0;
  for (const s of SERVICES) {
    const categoryId = categoryIds.get(s.category);
    if (!categoryId) throw new Error(`Unknown category ${s.category}`);
    await db.service.upsert({
      where: { slug: s.slug },
      create: { categoryId, name: s.name, slug: s.slug, summary: s.summary, description: s.description, content: s.content, order: serviceOrder++, isActive: true },
      update: {},
    });
  }
  console.log(`Catalog: ${CATEGORIES.length} categories, ${SERVICES.length} services (existing ones kept as they are).`);
}

async function main() {
  await seedSuperAdmin();
  await seedCatalog();
  if (process.argv.includes("--demo") || process.env.SEED_DEMO === "1") await seedDemo(db);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await db.$disconnect();
    process.exit(1);
  });
