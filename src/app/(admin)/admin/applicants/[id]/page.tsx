import Link from "next/link";
import { FileText } from "lucide-react";
import { ActionButton } from "@/components/admin/actions";
import { ApplicantFormButton } from "@/components/admin/party-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatDate, formatDateTime, formatPhone, humanize } from "@/lib/format";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { deleteApplicant } from "@/server/modules/parties/applicant/applicant.actions";
import { getApplicant } from "@/server/modules/parties/applicant/applicant.queries";

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getApplicant.page({ id });
  return (
    <>
      <PageHeader
        back={{ href: "/admin/applicants", label: "Applicants" }}
        title={a.fullName}
        subtitle={`${a.trade} · ${a.age} years · profile since ${formatDate(a.createdAt)}`}
        actions={
          <>
            {a.cvLink && (
              <a href={a.cvLink} target="_blank" rel="noopener noreferrer" className={buttonClass("dark", "sm")}>
                <FileText className="h-4 w-4" /> Download CV
              </a>
            )}
            <ApplicantFormButton a={a} uploadsEnabled={(await hasActiveStorage("PRIVATE"))} />
            {a.can.delete && (
              <ActionButton variant="danger" confirm="Delete this applicant profile?" action={deleteApplicant.bind(null, { id: a.id })} redirectTo="/admin/applicants" success="Applicant deleted.">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Panel title="Profile">
          <DefList
            rows={[
              ["Phone", formatPhone(a.phone)],
              ["Email", a.email],
              ["Date of birth", formatDate(a.dateOfBirth)],
              ["Gender", humanize(a.gender)],
              ["District", a.district],
              ["Experience", a.experience],
              ["Education", a.details?.educationLevel],
              ["Languages", a.details?.languages?.join(", ")],
              ["Skills", a.details?.skills?.join(", ")],
              ["Certifications", a.details?.certifications?.join(", ")],
              ["Nationality", a.details?.nationality],
              ["CV", a.hasCv ? (a.cvLink ? "Available" : "Stored (storage not configured here)") : "None"],
              ["Consent", formatDateTime(a.consentAt)],
              ["Notes", a.notes],
            ]}
          />
        </Panel>
        <Panel title={`Applications (${a.applications.length})`}>
          {a.applications.length ? (
            <ul className="divide-y divide-line/50 text-sm">
              {a.applications.map((ap) => (
                <li key={ap.id} className="flex items-center gap-3 py-2.5">
                  <Link href={`/admin/workforce-requests/${ap.workforceRequest.id}`} className="font-mono font-semibold hover:underline">
                    WR-{String(ap.workforceRequest.number).padStart(4, "0")}
                  </Link>
                  <span className="flex-1">{ap.workforceRequest.role}</span>
                  <span className="text-xs text-muted">{formatDate(ap.createdAt)}</span>
                  <StatusPill status={ap.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No applications.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
