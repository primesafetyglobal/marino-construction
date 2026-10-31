import type { Metadata } from "next";
import Link from "next/link";
import { DIVISIONS } from "@/config/divisions";
import { Stars } from "@/components/ui/stars";
import { LoadMoreGrid } from "@/components/public/load-more";
import { ReviewForm } from "@/components/public/review-form";
import { Container, PageHero, Section } from "@/components/public/section";
import { cn } from "@/lib/cn";
import { getPublicReviews, getReviewSummary } from "@/server/modules/access/review/review.queries";

export const metadata: Metadata = { title: "Reviews and feedback", description: "What our clients say about Marino Construction and Supply Solutions Ltd." };

type Props = { searchParams: Promise<{ division?: string }> };

export default async function ReviewsPage({ searchParams }: Props) {
  const { division: raw } = await searchParams;
  const division = DIVISIONS.find((d) => d.enum === raw)?.enum;
  const [reviews, summary] = await Promise.all([getPublicReviews.page({ division, limit: 9 }), getReviewSummary.page({ division })]);
  return (
    <>
      <PageHero eyebrow="Reviews" title="What our clients say">
        {summary.average !== null ? (
          <p className="flex items-center gap-3 text-muted">
            <Stars value={summary.average} size={20} /> <span className="text-2xl font-bold text-ink">{summary.average.toFixed(1)}</span> from {summary.count} review{summary.count === 1 ? "" : "s"}
          </p>
        ) : null}
      </PageHero>
      <Container className="no-scrollbar flex gap-2 overflow-x-auto pt-8">
        <Link href="/reviews" className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium", !division ? "bg-charcoal text-white" : "bg-mist")}>
          All
        </Link>
        {DIVISIONS.map((d) => (
          <Link key={d.enum} href={`/reviews?division=${d.enum}`} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium", division === d.enum ? "bg-charcoal text-white" : "bg-mist")}>
            {d.shortName}
          </Link>
        ))}
      </Container>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            {reviews.items.length ? (
              <LoadMoreGrid key={division ?? "all"} kind="review" initial={reviews.items} nextCursor={reviews.nextCursor} params={{ division, limit: "9" }} cols={2} />
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-line p-10 text-center">
                <p className="text-lg font-semibold">Be the first to share your experience</p>
                <p className="mt-1 text-sm text-muted">Your review appears here once our team approves it.</p>
              </div>
            )}
          </div>
          <aside id="share" className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft">
              <h2 className="mb-4 text-xl font-bold">Share your experience</h2>
              <ReviewForm />
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
