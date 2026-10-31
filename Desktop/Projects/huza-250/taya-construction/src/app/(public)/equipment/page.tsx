import type { Metadata } from "next";
import { divisionBySlug } from "@/config/divisions";
import { DivisionPage } from "@/components/public/division-page";

const division = divisionBySlug("equipment")!;

export const metadata: Metadata = { title: division.name, description: `${division.tagline}. ${division.intro}` };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DivisionPage division={division} searchParams={await searchParams} />;
}
