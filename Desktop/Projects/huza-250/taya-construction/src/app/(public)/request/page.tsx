import type { Metadata } from "next";
import { divisionBySlug, DIVISIONS } from "@/config/divisions";
import { RequestChooser } from "@/components/public/request-chooser";
import { Container, PageHero } from "@/components/public/section";

export const metadata: Metadata = { title: "Request a quote" };

// Full-page fallback for the request sheet (?division=<slug>).
export default async function RequestPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const slug = (await searchParams).division;
  const preselected = slug ? (divisionBySlug(slug)?.enum ?? DIVISIONS.find((d) => d.enum === slug)?.enum) : undefined;
  return (
    <>
      <PageHero title="Request a quote" intro="Two short steps, no account. We reply quickly by phone or WhatsApp." />
      <Container className="max-w-3xl py-12">
        <RequestChooser preselected={preselected} />
      </Container>
    </>
  );
}
