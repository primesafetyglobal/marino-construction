import { ApplicantsList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listApplicants } from "@/server/modules/parties/applicant/applicant.queries";

export const metadata = { title: "Applicants" };

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "trade", "district", "gender", "minAge", "maxAge"]);
  const page = await listApplicants.page(params);
  return (
    <>
      <PageHeader title="Applicants" subtitle="Reusable job-seeker profiles. Created when someone applies to a job post." />
      <ApplicantsList initial={jsonify(page)} params={params} />
    </>
  );
}
