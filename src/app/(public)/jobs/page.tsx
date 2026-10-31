import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { LoadMoreGrid } from "@/components/public/load-more";
import { PageHero, Section } from "@/components/public/section";
import { getOpenJobs } from "@/server/modules/operations/workforce-request/workforce-request.queries";

export const metadata: Metadata = { title: "Jobs", description: "Open construction and technical jobs through Marino Workforce." };

export default async function JobsPage() {
  const jobs = await getOpenJobs.page({ limit: 20 });
  return (
    <>
      <PageHero eyebrow="Workforce" title="Open jobs" intro="Skilled workers, operators and technical professionals: apply once, then use only your phone or email next time." />
      <Section>
        {jobs.items.length ? (
          <LoadMoreGrid kind="job" initial={jobs.items} nextCursor={jobs.nextCursor} params={{ limit: "20" }} />
        ) : (
          <EmptyState
            title="No open jobs right now"
            action={
              <Link href="/workforce" className={buttonClass("outline")}>
                Go to Workforce
              </Link>
            }
          >
            New posts appear here as soon as clients need workers.
          </EmptyState>
        )}
      </Section>
    </>
  );
}
