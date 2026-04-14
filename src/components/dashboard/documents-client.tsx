"use client";

import { useState } from "react";
import {
  Search,
  Download,
  Trash2,
  Eye,
  Share2,
  FileSignature,
  Filter,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { EDocumentStatus } from "@/types";

interface DocumentRow {
  id: string;
  name: string;
  status: EDocumentStatus;
  lastUpdated: string;
}

const mockDocs: DocumentRow[] = [
  { id: "1", name: "Contract-2026-04.pdf", status: EDocumentStatus.Signed, lastUpdated: "Apr 10, 2026" },
  { id: "2", name: "NDA-Client-A.pdf", status: EDocumentStatus.Pending, lastUpdated: "Apr 9, 2026" },
  { id: "3", name: "Offer-Letter-John.pdf", status: EDocumentStatus.Draft, lastUpdated: "Apr 8, 2026" },
  { id: "4", name: "Invoice-March.pdf", status: EDocumentStatus.Verified, lastUpdated: "Apr 7, 2026" },
  { id: "5", name: "Agreement-B2B.pdf", status: EDocumentStatus.Signed, lastUpdated: "Apr 5, 2026" },
  { id: "6", name: "Policy-Update.pdf", status: EDocumentStatus.Declined, lastUpdated: "Apr 3, 2026" },
];

const statusColors: Record<EDocumentStatus, string> = {
  [EDocumentStatus.Draft]: "bg-stone-100 text-stone-600",
  [EDocumentStatus.Pending]: "bg-amber-100 text-amber-700",
  [EDocumentStatus.Signed]: "bg-olive-100 text-olive-700",
  [EDocumentStatus.Verified]: "bg-lime-100 text-lime-700",
  [EDocumentStatus.Declined]: "bg-red-100 text-red-700",
};

const statusFilters = ["All", ...Object.values(EDocumentStatus)] as const;

export function DocumentsClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filtered = mockDocs.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-stone-300 bg-white/60 pl-9 pr-3 text-sm text-stone-700 placeholder:text-stone-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-500/20 backdrop-blur-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="size-4 shrink-0 text-stone-400" />
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-olive-600 text-white"
                  : "bg-white/60 text-stone-500 hover:bg-olive-50 hover:text-olive-700"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200/50">
                <th className="px-4 py-3 font-medium text-stone-500">Name</th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 sm:table-cell">Status</th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 md:table-cell">Last Updated</th>
                <th className="px-4 py-3 font-medium text-stone-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-stone-100/50 hover:bg-white/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <FileSignature className="size-4 shrink-0 text-stone-400" />
                      <span className="font-medium text-stone-700 truncate max-w-50">{doc.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold sm:hidden", statusColors[doc.status])}>
                        {doc.status}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", statusColors[doc.status])}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-stone-400 md:table-cell">{doc.lastUpdated}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors" title="View">
                        <Eye className="size-3.5" />
                      </button>
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors" title="Download">
                        <Download className="size-3.5" />
                      </button>
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors" title="Share">
                        <Share2 className="size-3.5" />
                      </button>
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-stone-400">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
