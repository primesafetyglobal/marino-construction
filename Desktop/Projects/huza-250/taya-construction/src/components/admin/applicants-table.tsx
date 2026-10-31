"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatPhone } from "@/lib/format";
import type { Jsonify } from "@/server/core/result";
import { deleteApplication, setApplicationStatus } from "@/server/modules/operations/job-application/job-application.actions";
import type { ApplicationItem } from "@/server/modules/operations/job-application/job-application.select";

const STATUSES = ["NEW", "SHORTLISTED", "PLACED", "REJECTED"] as const;

export function ApplicantsTable({ items, canUpdate, canDelete }: { items: Jsonify<ApplicationItem>[]; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  if (!items.length) return <p className="text-sm text-muted">No applications yet. Publish the job to receive applications.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted uppercase">
          <tr>
            <th className="py-2 pr-3">Applicant</th>
            <th className="py-2 pr-3">Trade</th>
            <th className="py-2 pr-3">Phone</th>
            <th className="py-2 pr-3">CV</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50">
          {items.map((a) => (
            <tr key={a.id}>
              <td className="py-2.5 pr-3">
                <Link href={`/admin/applicants/${a.applicant.id}`} className="font-semibold hover:underline">
                  {a.applicant.fullName}
                </Link>
                <span className="block text-xs text-muted">Applied {formatDate(a.createdAt)}</span>
                {a.message && <span className="block text-xs italic text-muted">“{a.message}”</span>}
              </td>
              <td className="py-2.5 pr-3">{a.applicant.trade}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap">{formatPhone(a.applicant.phone)}</td>
              <td className="py-2.5 pr-3">
                {a.applicant.cvLink ? (
                  <a href={a.applicant.cvLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                    <FileText className="h-4 w-4" /> CV
                  </a>
                ) : a.applicant.hasCv ? (
                  "Stored"
                ) : (
                  "-"
                )}
              </td>
              <td className="py-2.5 pr-3">
                {canUpdate ? (
                  <Select
                    aria-label="Application status"
                    className="h-9 w-36"
                    value={a.status}
                    onChange={async (e) => {
                      const r = await setApplicationStatus({ id: a.id, status: e.target.value as (typeof STATUSES)[number] });
                      if (!r.ok) return toast("error", r.error.message);
                      toast("success", "Status updated.");
                      router.refresh();
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <StatusPill status={a.status} />
                )}
              </td>
              <td className="py-2.5">
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this application (spam)?")) return;
                      const r = await deleteApplication({ id: a.id });
                      if (!r.ok) return toast("error", r.error.message);
                      toast("success", "Application deleted.");
                      router.refresh();
                    }}
                  >
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
