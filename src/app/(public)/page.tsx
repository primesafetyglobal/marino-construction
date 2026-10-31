import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ArrowDown, ArrowUpRight, MessageCircle, PaintRoller } from "lucide-react";
import { DIVISIONS } from "@/config/divisions";
import { SITE, whatsappHref } from "@/config/site";
import { buttonClass } from "@/components/ui/button";
import { DivisionIcon } from "@/components/ui/icons";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { Stars } from "@/components/ui/stars";
import { DivisionCard, EquipmentCard, ProductCard, ReviewCard, ServiceCard, TrainingCard } from "@/components/public/cards";
import { RequestButton } from "@/components/public/request-sheet";
import { Container, Scroller, Section, SectionHeading } from "@/components/public/section";
import { getFeaturedEquipment } from "@/server/modules/catalog/equipment/equipment.queries";
import { getFeaturedProducts } from "@/server/modules/catalog/product/product.queries";
import { getFeaturedServices } from "@/server/modules/catalog/service/service.queries";
import { getFeaturedTrainings } from "@/server/modules/catalog/training/training.queries";
import { getFeaturedShops } from "@/server/modules/parties/vendor/vendor.queries";
import { getPublicReviews, getReviewSummary } from "@/server/modules/access/review/review.queries";

// Home: sections in the client's order (Design §6). A featured section with
// no items is hidden.
export default function HomePage() {
  return (
    <>
      {/* 1. Hero with the 8 division chips, on the site photo */}
      <section className="relative isolate overflow-hidden text-white">
        <Image src="/images/marino-cons_hero.webp" alt="Excavator loading a truck on a construction site above Kigali at sunset" fill priority sizes="100vw" className="-z-20 object-cover object-[70%_center]" />
        {/* Warm earth overlay (not black): readable text on the left, the machines stay visible on the right. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-charcoal/92 via-charcoal/65 to-charcoal/10" />
        {/* Blueprint grid: the site-office signature (fades out over the machines). */}
        <div className="blueprint-dark absolute inset-0 -z-10 [mask-image:linear-gradient(to_right,black_35%,transparent_75%)]" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-charcoal/70 to-transparent" />
        <Container className="relative flex min-h-[560px] flex-col justify-center py-20 lg:min-h-[640px] lg:py-24">
          <p className="mb-5 inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            <span className="h-[3px] w-8 rounded-full bg-brand" aria-hidden />
            {SITE.name}
          </p>
          <h1 className="max-w-3xl animate-fade-up text-[44px] leading-[0.98] font-bold [font-stretch:80%] sm:text-6xl lg:text-[84px]">
            Everything Your Project <span className="text-brand">Needs</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/90">
            Equipment, materials, inspections, trainings, waste management, skilled workers, engineering and painting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <RequestButton size="lg" className="rounded-full" testId="hero-request">
              Request a quote
            </RequestButton>
            <a href="#divisions" className={buttonClass("light", "lg", "backdrop-blur")}>
              Explore our divisions <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <ul className="mt-10 flex max-w-3xl flex-wrap gap-2" aria-label="Divisions">
            {DIVISIONS.map((d) => (
              <li key={d.slug}>
                <Link href={`/${d.slug}`} className="flex items-center gap-2 rounded-[10px] border border-white/20 bg-charcoal/40 px-3.5 py-2 text-sm font-medium transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-charcoal">
                  <DivisionIcon icon={d.icon} className="h-4 w-4" />
                  {d.shortName}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 2. Our achievements */}
      <section className="border-b border-line bg-white">
        <Container className="grid grid-cols-2 divide-line py-2 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {SITE.achievements.map((a) => (
            <div key={a.label} className="px-4 py-5">
              <p className="num text-[32px] leading-none font-semibold">{a.value}</p>
              <p className="mt-2 text-xs text-muted">{a.label}</p>
            </div>
          ))}
        </Container>
      </section>

      {/* 3-6. Featured sections, each loaded on its own */}
      <Suspense fallback={<Fallback />}>
        <FeaturedEquipment />
      </Suspense>
      <Suspense fallback={<Fallback />}>
        <FeaturedMaterials />
      </Suspense>
      <Suspense fallback={<Fallback />}>
        <FeaturedInspections />
      </Suspense>
      <Suspense fallback={<Fallback />}>
        <FeaturedTrainings />
      </Suspense>

      {/* 7. Our 8 major business divisions */}
      <Section id="divisions" tone="mist">
        <SectionHeading eyebrow="What we do" title="Our 8 major business divisions" intro="People know what they want: pick a division and request in two clicks." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DIVISIONS.map((d) => (
            <DivisionCard key={d.slug} division={d} />
          ))}
        </div>
      </Section>

      {/* 8-9. Reviews, shops */}
      <Suspense fallback={null}>
        <ClientsSay />
      </Suspense>
      <Suspense fallback={null}>
        <Shops />
      </Suspense>

      {/* 11. CTA band */}
      <section className="bg-brand text-charcoal">
        <Container className="flex flex-col items-start justify-between gap-6 py-16 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Let&apos;s build your next project</h2>
            <p className="mt-2 text-charcoal/75">Tell us what you need. We reply quickly, by phone or WhatsApp.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <RequestButton size="lg" variant="dark">
              Request a quote
            </RequestButton>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "lg", "border-charcoal/20 bg-white/80")}>
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}

// The home page is the front door: a failing featured section is logged and
// hidden instead of taking the whole page down.
async function optional<T>(load: Promise<T>, fallback: T): Promise<T> {
  try {
    return await load;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[home] featured section failed", err);
    return fallback;
  }
}

function Fallback() {
  return (
    <Section>
      <CardGridSkeleton count={4} />
    </Section>
  );
}

async function FeaturedEquipment() {
  const items = await optional(getFeaturedEquipment.page({ limit: 8 }), []);
  if (!items.length) return null;
  return (
    <Section>
      <SectionHeading eyebrow="Equipment" title="Featured equipment for rent" href="/equipment" />
      <Scroller>
        {items.map((i) => (
          <EquipmentCard key={i.id} item={i} />
        ))}
      </Scroller>
    </Section>
  );
}

async function FeaturedMaterials() {
  const items = await optional(getFeaturedProducts.page({ limit: 8 }), []);
  if (!items.length) return null;
  return (
    <Section tone="mist">
      <SectionHeading eyebrow="Materials" title="Featured construction materials" href="/materials" />
      <Scroller>
        {items.map((i) => (
          <ProductCard key={i.id} item={i} />
        ))}
      </Scroller>
    </Section>
  );
}

async function FeaturedInspections() {
  const items = await optional(getFeaturedServices.page({ division: "INSPECTION_TESTING", limit: 4 }), []);
  if (!items.length) return null;
  return (
    <Section>
      <SectionHeading eyebrow="Inspection & Testing" title="Featured inspections & testing" href="/inspection-testing" />
      <Scroller>
        {items.map((i) => (
          <ServiceCard key={i.id} item={i} />
        ))}
      </Scroller>
    </Section>
  );
}

async function FeaturedTrainings() {
  const items = await optional(getFeaturedTrainings.page({ limit: 4 }), []);
  if (!items.length) return null;
  return (
    <Section tone="mist">
      <SectionHeading eyebrow="Safety & Training" title="Featured construction and safety trainings" intro="Courses are delivered and certified by Prime Safety Global." href="/training" />
      <Scroller>
        {items.map((i) => (
          <TrainingCard key={i.id} item={i} />
        ))}
      </Scroller>
    </Section>
  );
}

async function ClientsSay() {
  const [reviews, summary] = await optional(Promise.all([getPublicReviews.page({ limit: 6 }), getReviewSummary.page({})]), [{ items: [], nextCursor: null }, { average: null, count: 0 }]);
  if (!reviews.items.length) return null;
  return (
    <Section>
      <SectionHeading
        eyebrow="Reviews"
        title="What our clients say"
        intro={
          summary.average !== null ? (
            <span className="flex items-center gap-2">
              <Stars value={summary.average} /> {summary.average.toFixed(1)} average from {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        href="/reviews"
        linkLabel="Read all reviews"
      />
      <Scroller>
        {reviews.items.slice(0, 4).map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </Scroller>
      <Link href="/reviews#share" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
        Share your experience <ArrowUpRight className="h-4 w-4" />
      </Link>
    </Section>
  );
}

async function Shops() {
  const shops = await optional(getFeaturedShops.page({}), []);
  return (
    <Section>
      <SectionHeading eyebrow="Shops" title="Featured shops" intro="Buy from our partner suppliers and the Paint Rwanda shop." />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <a
            href={SITE.links.paintShop}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-brand-hover/40 bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-charcoal/40 hover:shadow-soft"
          >
            <span className="flex aspect-[16/10] items-center justify-center bg-brand">
              <PaintRoller className="h-12 w-12 text-charcoal" aria-hidden />
            </span>
            <span className="flex flex-1 items-start justify-between gap-2 border-t border-brand-hover/30 px-4 py-3.5">
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">Paint Rwanda shop</span>
                <span className="mt-0.5 block text-xs text-muted">Paint and finishes</span>
              </span>
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" aria-hidden />
            </span>
          </a>
        </li>
        {shops.map((s) => {
          const name = s.companyName ?? s.name;
          return (
            <li key={s.id}>
              <a
                href={s.website!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${name} (opens the shop website)`}
                className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-soft"
              >
                <span className="flex aspect-[16/10] items-center justify-center bg-canvas p-5">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt={`${name} logo`} className="h-full max-h-24 w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-[14px] border border-line bg-white font-display text-2xl font-semibold text-ink [font-stretch:88%]" aria-hidden>
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="flex flex-1 items-start justify-between gap-2 border-t border-line px-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug">{name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Partner supplier</span>
                  </span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" aria-hidden />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

