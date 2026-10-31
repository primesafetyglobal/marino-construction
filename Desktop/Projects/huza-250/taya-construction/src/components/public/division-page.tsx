import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarCheck, CheckCircle2, ClipboardList, Cog, HardHat, MessageCircle, Package, Truck, Users, Wallet } from "lucide-react";
import type { Division } from "@/config/divisions";
import { SITE, whatsappHref } from "@/config/site";
import { buttonClass } from "@/components/ui/button";
import { DivisionIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { ProductCard, ServiceCard, TrainingCard } from "./cards";
import { LoadMoreGrid } from "./load-more";
import { RequestButton, type RequestTarget } from "./request-sheet";
import { Container, Grid, Section, SectionHeading } from "./section";
import { WorkforceInlineForm } from "./workforce-form";
import { getCategoriesByDivision } from "@/server/modules/catalog/category/category.queries";
import { listEquipment } from "@/server/modules/catalog/equipment/equipment.queries";
import { getPaintProducts, listProducts } from "@/server/modules/catalog/product/product.queries";
import { getServicesByDivision } from "@/server/modules/catalog/service/service.queries";
import { getPublishedTrainings } from "@/server/modules/catalog/training/training.queries";
import { getOpenJobs } from "@/server/modules/operations/workforce-request/workforce-request.queries";
import { JobCard } from "./cards";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function targetFor(d: Division): RequestTarget | null {
  switch (d.variant) {
    case "equipment":
      return { kind: "equipment" };
    case "materials":
      return { kind: "supply" };
    case "workforce":
      return { kind: "workforce" };
    case "training":
      return null;
    default:
      return { kind: "service", division: d.enum, installments: d.variant === "paint" };
  }
}

// One template for the 8 division pages, with variants (Design §6).
export async function DivisionPage({ division, searchParams }: { division: Division; searchParams: SearchParams }) {
  const target = targetFor(division);
  const isPaint = division.variant === "paint";
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-sand-deep via-sand to-white">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute inset-0 text-earth opacity-[0.06] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]" />
        <Container className="relative py-12 lg:py-16">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-charcoal">
              <DivisionIcon icon={division.icon} className="h-6 w-6" />
            </span>
            <p className="text-xs font-semibold tracking-[0.16em] text-earth uppercase">{division.tagline}</p>
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{isPaint ? "We Paint. You Pay Later!" : division.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{isPaint ? division.intro : division.heading}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {target ? (
              <RequestButton size="lg" target={target} testId="division-request">
                {division.variant === "workforce" ? "Request workers" : isPaint ? "Request painting" : "Request a quote"}
              </RequestButton>
            ) : (
              <a href={SITE.links.primeSafetyGlobal} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
                Browse courses on Prime Safety Global <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            <a href={whatsappHref(`Hello Marino, I'm interested in ${division.name}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "lg")}>
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
          </div>
        </Container>
      </section>

      {/* Sticky sub-navigation chips */}
      <nav className="sticky top-16 z-30 border-b border-line/50 bg-white/80 backdrop-blur-xl lg:top-[105px]" aria-label={`${division.name} sections`}>
        <Container className="no-scrollbar flex gap-2 overflow-x-auto py-3">
          {division.subServices.map((s) => (
            <a key={s} href="#offerings" className="shrink-0 rounded-full bg-mist px-4 py-1.5 text-sm font-medium hover:bg-brand-tint">
              {s}
            </a>
          ))}
        </Container>
      </nav>

      <div id="offerings">
        {division.variant === "equipment" && <EquipmentVariant division={division} searchParams={searchParams} />}
        {division.variant === "training" && <TrainingVariant searchParams={searchParams} />}
        {division.variant === "services" && <ServicesVariant division={division} />}
        {division.variant === "materials" && <MaterialsVariant division={division} searchParams={searchParams} />}
        {division.variant === "workforce" && <WorkforceVariant />}
        {division.variant === "paint" && <PaintVariant division={division} />}
      </div>

      {/* Why Marino + request band */}
      <Section tone="mist">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Why Marino</p>
            <h2 className="text-3xl font-bold tracking-tight">{isPaint ? "Making professional painting more accessible" : division.heading}</h2>
            <p className="mt-4 text-muted">{division.intro}</p>
          </div>
          <ul className="space-y-3">
            {division.why.map((w) => (
              <li key={w} className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <section className="bg-brand text-charcoal">
        <Container className="flex flex-col items-start justify-between gap-5 py-12 sm:flex-row sm:items-center">
          <p className="text-2xl font-bold tracking-tight">Ready when you are. Tell us what you need.</p>
          <div className="flex flex-wrap gap-3">
            {target && (
              <RequestButton target={target} variant="dark">
                Request a quote
              </RequestButton>
            )}
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "md", "border-charcoal/20 bg-white/80")}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors", active ? "bg-charcoal text-white" : "bg-mist text-ink hover:bg-brand-tint")}>
      {children}
    </Link>
  );
}

async function EquipmentVariant({ division, searchParams }: { division: Division; searchParams: SearchParams }) {
  const mode = one(searchParams.mode) === "sale" ? "sale" : one(searchParams.mode) === "rent" ? "rent" : undefined;
  const category = one(searchParams.category);
  const [categories, page, services] = await Promise.all([
    getCategoriesByDivision.page({ division: "EQUIPMENT" }),
    listEquipment.page({ view: "public", mode, category, limit: 12 }),
    getServicesByDivision.page({ division: "EQUIPMENT" }),
  ]);
  const href = (p: { mode?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (p.mode) sp.set("mode", p.mode);
    if (p.category) sp.set("category", p.category);
    const qs = sp.toString();
    return `/${division.slug}${qs ? `?${qs}` : ""}#offerings`;
  };
  const equipmentCategories = categories.filter((c) => c.type === "EQUIPMENT");
  return (
    <>
      <Section>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-full bg-mist p-1">
            {[
              { v: undefined, l: "All" },
              { v: "rent", l: "Rent" },
              { v: "sale", l: "Buy" },
            ].map((o) => (
              <Link key={o.l} href={href({ mode: o.v, category })} scroll={false} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", mode === o.v ? "bg-white shadow-sm" : "text-muted")}>
                {o.l}
              </Link>
            ))}
          </div>
        </div>
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto">
          <Chip href={href({ mode })} active={!category}>
            All equipment
          </Chip>
          {equipmentCategories.map((c) => (
            <Chip key={c.slug} href={href({ mode, category: c.slug })} active={category === c.slug}>
              {c.name}
            </Chip>
          ))}
        </div>
        {page.items.length ? (
          <LoadMoreGrid key={`${mode}-${category}`} kind="equipment" initial={page.items} nextCursor={page.nextCursor} params={{ view: "public", mode, category, limit: "12" }} />
        ) : (
          <EmptyState title="No equipment listed here yet" action={<RequestButton target={{ kind: "equipment" }}>Ask us to source it</RequestButton>}>
            Tell us what you need and we will find it through our network.
          </EmptyState>
        )}
      </Section>

      {services.length > 0 && (
        <Section tone="mist">
          <SectionHeading eyebrow="Spare parts & maintenance" title="Equipment services" />
          <Grid cols={3}>
            {services.map((s) => (
              <ServiceCard key={s.id} item={s} />
            ))}
          </Grid>
        </Section>
      )}

      <Section>
        <div className="flex flex-col items-start justify-between gap-6 rounded-[var(--radius-card)] bg-brand-tint p-8 sm:flex-row sm:items-center lg:p-12">
          <div className="max-w-xl">
            <Truck className="mb-3 h-8 w-8" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Have idle equipment? Rent it out or sell it</h2>
            <p className="mt-2 text-muted">Turn your idle equipment into an opportunity. We connect owners with contractors and companies who need machines.</p>
          </div>
          <Link href="/equipment/list-yours" className={buttonClass("dark", "lg")}>
            List your equipment
          </Link>
        </div>
      </Section>
    </>
  );
}

async function TrainingVariant({ searchParams }: { searchParams: SearchParams }) {
  const type = one(searchParams.type) === "HSE" ? "HSE" : one(searchParams.type) === "CONSTRUCTION" ? "CONSTRUCTION" : undefined;
  const trainings = await getPublishedTrainings.page({ type });
  return (
    <Section>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Chip href="/training#offerings" active={!type}>
            All
          </Chip>
          <Chip href="/training?type=HSE#offerings" active={type === "HSE"}>
            HSE
          </Chip>
          <Chip href="/training?type=CONSTRUCTION#offerings" active={type === "CONSTRUCTION"}>
            Construction
          </Chip>
        </div>
        <a href={SITE.links.verifyCertificate} target="_blank" rel="noopener noreferrer" className={buttonClass("outline")}>
          <BadgeCheck className="h-4 w-4" /> Verify a certificate
        </a>
      </div>
      {trainings.length ? (
        <Grid cols={3}>
          {trainings.map((t) => (
            <TrainingCard key={t.id} item={t} />
          ))}
        </Grid>
      ) : (
        <EmptyState title="No trainings listed yet">Browse all courses on Prime Safety Global.</EmptyState>
      )}
    </Section>
  );
}

async function ServicesVariant({ division }: { division: Division }) {
  const services = await getServicesByDivision.page({ division: division.enum });
  return (
    <Section>
      <SectionHeading title={division.heading} intro={division.intro} />
      {services.length ? (
        <Grid cols={3}>
          {services.map((s) => (
            <ServiceCard key={s.id} item={s} />
          ))}
        </Grid>
      ) : (
        <EmptyState title="Services coming soon" action={<RequestButton target={{ kind: "service", division: division.enum }}>Request a quote</RequestButton>} />
      )}
    </Section>
  );
}

async function MaterialsVariant({ division, searchParams }: { division: Division; searchParams: SearchParams }) {
  const category = one(searchParams.category);
  const [categories, page] = await Promise.all([getCategoriesByDivision.page({ division: "MATERIALS" }), listProducts.page({ view: "public", category, limit: 12 })]);
  return (
    <>
      <Section>
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto">
          <Chip href={`/${division.slug}#offerings`} active={!category}>
            All materials
          </Chip>
          {categories
            .filter((c) => c.type === "PRODUCT")
            .map((c) => (
              <Chip key={c.slug} href={`/${division.slug}?category=${c.slug}#offerings`} active={category === c.slug}>
                {c.name}
              </Chip>
            ))}
        </div>
        {page.items.length ? (
          <LoadMoreGrid key={category ?? "all"} kind="product" initial={page.items} nextCursor={page.nextCursor} params={{ view: "public", category, limit: "12" }} />
        ) : (
          <EmptyState title="No products listed here yet" action={<RequestButton target={{ kind: "supply" }}>Request a quotation</RequestButton>}>
            We source materials on request through our supplier network.
          </EmptyState>
        )}
      </Section>
      <Section tone="mist">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Package className="mb-3 h-8 w-8" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Bulk or project supply? Request a quote</h2>
            <p className="mt-2 text-muted">For product availability, technical requirements, bulk orders or project-based supply.</p>
          </div>
          <RequestButton size="lg" target={{ kind: "supply" }}>
            Request a quote
          </RequestButton>
        </div>
      </Section>
    </>
  );
}

async function WorkforceVariant() {
  const jobs = await getOpenJobs.page({ limit: 5 });
  const info = [
    { icon: Users, title: "Skilled workers", text: "Steel fixers, masons, carpenters, electricians, plumbers, welders, painters, tilers and general workers." },
    { icon: Cog, title: "Equipment operators", text: "Excavator, loader, bulldozer, grader, roller, crane operators and tipper or truck drivers." },
    { icon: HardHat, title: "Technical professionals", text: "Engineers, site supervisors, technicians, safety professionals and construction foremen." },
  ];
  return (
    <>
      <Section id="request-workers">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Request workers</p>
            <h2 className="text-3xl font-bold tracking-tight">Reliable people for construction & technical projects</h2>
            <p className="mt-3 text-muted">Whether you need a single skilled worker, a specialized technician, an equipment operator, or a complete project workforce.</p>
            <ul className="mt-6 space-y-3">
              {info.map((i) => (
                <li key={i.title} className="flex gap-3 rounded-2xl bg-mist p-4">
                  <i.icon className="h-6 w-6 shrink-0" />
                  <span>
                    <span className="block font-semibold">{i.title}</span>
                    <span className="text-sm text-muted">{i.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft lg:p-8">
            <WorkforceInlineForm />
          </div>
        </div>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Looking for work?" title="Open jobs" href="/jobs" linkLabel="All jobs" />
        {jobs.items.length ? (
          <div className="space-y-3">
            {jobs.items.map((j) => (
              <JobCard key={j.number} job={j} />
            ))}
          </div>
        ) : (
          <EmptyState title="No open jobs right now">Check back soon.</EmptyState>
        )}
      </Section>
    </>
  );
}

async function PaintVariant({ division }: { division: Division }) {
  const [services, paints] = await Promise.all([getServicesByDivision.page({ division: "PAINT_RWANDA" }), getPaintProducts.page({ limit: 8 })]);
  const steps = [
    { icon: ClipboardList, title: "Request", text: "Tell us about your home, shop or project." },
    { icon: CalendarCheck, title: "Agree the plan", text: "We quote and agree an installment plan with you." },
    { icon: Wallet, title: "Pay in installments", text: "We paint now. You pay later, in agreed installments." },
  ];
  return (
    <>
      <Section>
        <SectionHeading eyebrow="Flexible payment" title="How pay-later works" />
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-bold text-charcoal">{i + 1}</span>
              <s.icon className="mt-4 h-6 w-6" />
              <p className="mt-2 text-lg font-semibold">{s.title}</p>
              <p className="text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Services" title="Professional painting services" intro="Homes and apartments, offices and shops, rental properties, renovations and new construction." />
        {services.length ? (
          <Grid cols={3}>
            {services.map((s) => (
              <ServiceCard key={s.id} item={s} />
            ))}
          </Grid>
        ) : (
          <EmptyState title="Services coming soon" action={<RequestButton target={{ kind: "service", division: division.enum, installments: true }}>Request painting</RequestButton>} />
        )}
      </Section>
      <Section>
        <SectionHeading eyebrow="Quality paint" title="Paint products" intro="Quality paints, coatings, primers and finishing products." />
        {paints.length > 0 && (
          <Grid>
            {paints.map((p) => (
              <ProductCard key={p.id} item={p} />
            ))}
          </Grid>
        )}
        <a href={SITE.links.paintShop} target="_blank" rel="noopener noreferrer" className={buttonClass("dark", "lg", "mt-8")}>
          Buy paint in our shop <ArrowUpRight className="h-4 w-4" />
        </a>
      </Section>
    </>
  );
}
