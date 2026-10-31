# Marino Construction and Supply Solutions Ltd platform

Public website and staff dashboard for marino-construction.rw. Next.js 16, Prisma 7.10 + PostgreSQL, NextAuth, Tailwind v4. Server code follows **DNSA Edition 1.0**, see `docs/DNSA.md` (stack, deviations, host setup) and `docs/modules/*.md`.

## Start

```bash
npm install
# .env: DATABASE_URL, NEXTAUTH_SECRET, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS, S3_* (see docs/DNSA.md)
npm run db:deploy               # apply migrations (prisma7.config.ts)
npm run db:seed                 # Super Admin (from .env) + categories + services
npm run db:seed:demo            # optional: fake "Demo" data for every screen
npm run dev
```

Sign in at `/login` with SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASS.

## Checks

```bash
npx tsc --noEmit && npm run lint
npm test                        # unit + database tests (uses <db>_test, wiped each run)
npx playwright test             # smoke flows (uses <db>_e2e, rebuilt each run)
npm run dnsa:check              # isolation, public entry points, db imports, six files, rule coverage
npx next build
```

Scheduled: `npm run auth:cleanup` daily. Fallback: `npm run auth:reset-super-admin -- <email>`.
