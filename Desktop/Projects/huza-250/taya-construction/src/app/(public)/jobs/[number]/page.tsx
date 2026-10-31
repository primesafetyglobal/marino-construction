import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, Clock, MapPin, Users } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/public/section";
import { ApplyButton } from "@/components/public/apply-sheet";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { getJobByNumber } from "@/server/modules/operations/workforce-request/workforce-request.queries";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getJobByNumber.page({ number: (await params).number });
  return { title: `${job.role} (${job.code})`, description: job.jobDescription?.slice(0, 160) };
}

export default async function JobPage({ params }: Props) {
  const job = await getJobByNumber.page({ number: (await params).number });
  return (
    <Container className="max-w-3xl py-10">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> All jobs
      </Link>
      <p className="mt-6 font-mono text-sm text-muted">{job.code}</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight">{job.role}</h1>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        <li className="flex items-center gap-2 rounded-2xl bg-mist px-4 py-3">
          <Users className="h-5 w-5" /> {job.quantity} needed
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-mist px-4 py-3">
          <MapPin className="h-5 w-5" /> {job.district}
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-mist px-4 py-3">
          <Clock className="h-5 w-5" /> {job.duration}
          {job.startDate ? `, from ${formatDate(job.startDate)}` : ""}
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-mist px-4 py-3">
          <CalendarDays className="h-5 w-5" /> {job.deadline ? `Apply by ${formatDate(job.deadline)}` : "Open until filled"}
        </li>
      </ul>
      {job.jobDescription && <div className="mt-8 leading-relaxed whitespace-pre-line">{job.jobDescription}</div>}
      <div className="sticky bottom-20 mt-10 flex items-center justify-between gap-4 rounded-2xl border border-line/60 bg-white/90 p-4 shadow-soft backdrop-blur lg:bottom-6">
        <p className="text-sm text-muted">Applied before? You only need your phone or email.</p>
        <ApplyButton jobNumber={job.number} role={job.role} uploadsEnabled={(await hasActiveStorage("PRIVATE"))} />
      </div>
    </Container>
  );
}
