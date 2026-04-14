"use client";

import {
  FileSignature,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize, EInvitationStatus } from "@/types";
import { cn } from "@/lib/utils";

interface InvitationRow {
  id: string;
  documentName: string;
  senderName: string;
  sentAt: string;
  expiresAt: string;
  status: EInvitationStatus;
}

const mockInvitations: InvitationRow[] = [
  {
    id: "1",
    documentName: "Partnership-Agreement.pdf",
    senderName: "Alice Johnson",
    sentAt: "Apr 10, 2026",
    expiresAt: "Apr 17, 2026",
    status: EInvitationStatus.Pending,
  },
  {
    id: "2",
    documentName: "Service-Contract.pdf",
    senderName: "Bob Williams",
    sentAt: "Apr 8, 2026",
    expiresAt: "Apr 15, 2026",
    status: EInvitationStatus.Pending,
  },
  {
    id: "3",
    documentName: "NDA-2026.pdf",
    senderName: "Carol Davis",
    sentAt: "Apr 5, 2026",
    expiresAt: "Apr 12, 2026",
    status: EInvitationStatus.Accepted,
  },
  {
    id: "4",
    documentName: "Old-Agreement.pdf",
    senderName: "Dave Miller",
    sentAt: "Mar 20, 2026",
    expiresAt: "Mar 27, 2026",
    status: EInvitationStatus.Expired,
  },
];

const statusConfig: Record<EInvitationStatus, { color: string; icon: typeof Clock }> = {
  [EInvitationStatus.Pending]: { color: "bg-amber-100 text-amber-700", icon: Clock },
  [EInvitationStatus.Accepted]: { color: "bg-olive-100 text-olive-700", icon: CheckCircle2 },
  [EInvitationStatus.Declined]: { color: "bg-red-100 text-red-700", icon: XCircle },
  [EInvitationStatus.Expired]: { color: "bg-stone-100 text-stone-500", icon: Clock },
};

export function InvitationsClient() {
  return (
    <div className="space-y-3">
      {mockInvitations.map((inv) => {
        const config = statusConfig[inv.status];
        return (
          <GlassCard key={inv.id} hover>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <FileSignature className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {inv.documentName}
                  </p>
                  <p className="text-xs text-stone-500">
                    From {inv.senderName} &middot; Sent {inv.sentAt}
                  </p>
                  <p className="text-xs text-stone-400">Expires {inv.expiresAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                    config.color
                  )}
                >
                  <config.icon className="size-3" />
                  {inv.status}
                </span>
                {inv.status === EInvitationStatus.Pending && (
                  <div className="flex gap-1.5">
                    <FormButton
                      label="Sign"
                      icon={ArrowRight}
                      size={EButtonSize.Small}
                      className="bg-olive-700 hover:bg-olive-600 text-white"
                    />
                    <FormButton
                      label="Decline"
                      icon={XCircle}
                      size={EButtonSize.Small}
                      variant="destructive"
                    />
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
