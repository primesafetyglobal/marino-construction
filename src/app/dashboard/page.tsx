import Link from "next/link";
import {
  FileSignature,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Mail,
  Plus,
  ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/shared";
import { EDocumentStatus } from "@/types";

const stats = [
  { label: "Pending Signatures", value: "3", icon: Clock, color: "text-amber-600 bg-amber-100" },
  { label: "Completed", value: "24", icon: CheckCircle2, color: "text-olive-600 bg-olive-100" },
  { label: "Invitations", value: "5", icon: Mail, color: "text-blue-600 bg-blue-100" },
];

const recentDocs = [
  { name: "Contract-2026-04.pdf", status: EDocumentStatus.Signed, date: "Apr 10, 2026" },
  { name: "NDA-Client-A.pdf", status: EDocumentStatus.Pending, date: "Apr 9, 2026" },
  { name: "Offer-Letter-John.pdf", status: EDocumentStatus.Draft, date: "Apr 8, 2026" },
  { name: "Invoice-March.pdf", status: EDocumentStatus.Verified, date: "Apr 7, 2026" },
];

const statusColors: Record<EDocumentStatus, string> = {
  [EDocumentStatus.Draft]: "bg-stone-100 text-stone-600",
  [EDocumentStatus.Pending]: "bg-amber-100 text-amber-700",
  [EDocumentStatus.Signed]: "bg-olive-100 text-olive-700",
  [EDocumentStatus.Verified]: "bg-lime-100 text-lime-700",
  [EDocumentStatus.Declined]: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            Welcome back. Here&apos;s your overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/sign"
            className="inline-flex items-center gap-2 rounded-xl bg-olive-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-olive-600"
          >
            <Plus className="size-4" /> New Document
          </Link>
          <Link
            href="/dashboard/verify"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white/60 px-4 py-2.5 text-sm font-medium text-stone-700 backdrop-blur-sm transition-colors hover:bg-white"
          >
            <ShieldCheck className="size-4" /> Verify
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {stats.map((s) => (
          <GlassCard key={s.label}>
            <div className="flex items-center gap-4">
              <div className={`flex size-11 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">{s.value}</p>
                <p className="text-xs text-stone-500">{s.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Recent Documents */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-stone-900">Recent Documents</h3>
          <Link
            href="/dashboard/documents"
            className="flex items-center gap-1 text-xs font-medium text-olive-600 hover:text-olive-700"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentDocs.map((doc) => (
            <div
              key={doc.name}
              className="flex items-center justify-between rounded-xl bg-white/40 px-4 py-3 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileSignature className="size-4 shrink-0 text-stone-400" />
                <span className="truncate text-sm font-medium text-stone-700">
                  {doc.name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden text-xs text-stone-400 sm:block">
                  {doc.date}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[doc.status]}`}
                >
                  {doc.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </>
  );
}
