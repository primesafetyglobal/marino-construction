import type { Metadata } from "next";
import { DIVISIONS } from "@/config/divisions";
import { SITE } from "@/config/site";
import { DivisionCard, ReviewCard } from "@/components/public/cards";
import { PageHero, Scroller, Section, SectionHeading } from "@/components/public/section";
import { RequestButton } from "@/components/public/request-sheet";
import { getPublicReviews } from "@/server/modules/access/review/review.queries";
import { getPartners } from "@/server/modules/parties/vendor/vendor.queries";

export const metadata: Metadata = { title: "About us", description: SITE.description };

export default async function AboutPage() {
  const [reviews, partners] = await Promise.all([getPublicReviews.page({ limit: 4 }), getPartners.page({})]);
  return (
    <>
      <PageHero eyebrow="About us" title="One group for everything your project needs">
        <RequestButton size="lg">Request a quote</RequestButton>
      </PageHero>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-[17px] leading-relaxed">
            <p>
              <strong>{SITE.name}</strong> brings eight construction divisions under one brand: Equipment, Safety &amp; Training, Inspection &amp; Testing, Materials, Waste Management, Workforce, Engineering &amp; Construction, and Paint Rwanda.
            </p>
            <p>Anyone building in Rwanda, from a homeowner to a contractor, has to find and manage many separate providers. We bring machines, materials, workers, inspections, waste removal and finishing works together, with one team that follows every request from first contact to delivery and payment.</p>
            <p>We work through our own teams and a trusted network of equipment owners, suppliers, garages, technicians, contractors and recyclers. Trainings and certifications are delivered by our sister company, Prime Safety Global.</p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {SITE.achievements.map((a) => (
              <div key={a.label} className="rounded-[var(--radius-card)] bg-mist p-5">
                <dt className="text-xs text-muted">{a.label}</dt>
                <dd className="mt-1 text-3xl font-bold tracking-tight">{a.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>
      <Section tone="mist">
        <SectionHeading title="Our 8 divisions" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DIVISIONS.map((d) => (
            <DivisionCard key={d.slug} division={d} />
          ))}
        </div>
      </Section>
      {partners.partners.length > 0 && (
        <Section>
          <SectionHeading title="Our partners" />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {partners.partners.map((p) => (
              <li key={p.id} className="flex h-20 items-center justify-center rounded-2xl border border-line/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo!} alt={p.companyName ?? p.name} className="max-h-12 object-contain" />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {reviews.items.length > 0 && (
        <Section tone="mist">
          <SectionHeading title="What our clients say" href="/reviews" />
          <Scroller>
            {reviews.items.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </Scroller>
        </Section>
      )}
    </>
  );
}
