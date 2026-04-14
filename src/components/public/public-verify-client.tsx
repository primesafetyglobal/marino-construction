"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  KeyRound,
  FileText,
  Building2,
  Mail,
  Hash,
  AlertTriangle,
  BadgeCheck,
  FileWarning,
} from "lucide-react";
import { UploadZone } from "@/components/shared/upload-zone";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import type { IVerificationReport, ISignerVerification } from "@/types";
import { verifyDocument } from "@/actions/verify-document";

export function PublicVerifyClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [report, setReport] = useState<IVerificationReport | null>(null);

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setReport(null);
    setIsVerifying(true);

    try {
      const formData = new FormData();
      formData.append("file", f, f.name);

      const result = await verifyDocument(formData);

      console.log("=== VERIFICATION REPORT (Public) ===");
      console.log("Valid:", result.isValid);
      console.log("Certified:", result.isCertified);
      console.log("Certification Level:", result.certificationLevel ?? "N/A");
      console.log("Signature Count:", result.signatureCount);
      console.log("Modified After Signing:", result.modifiedAfterSigning);
      console.log("Signers:", result.signers);
      if (result.error) console.error("Error:", result.error);
      console.log("====================================");

      setReport(result);
    } catch (err) {
      console.error("Verification error:", err);
      setReport({
        isValid: false,
        isCertified: false,
        signers: [],
        modifiedAfterSigning: false,
        signatureCount: 0,
        error: err instanceof Error ? err.message : "Verification failed.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!file) {
    return (
      <div className="mx-auto max-w-xl">
        <UploadZone
          label="Drop a signed PDF here to verify"
          onFileSelect={handleFileSelect}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* File Info */}
      <GlassCard>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
            <FileText className="size-5 text-stone-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
            <p className="text-xs text-stone-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={() => { setFile(null); setReport(null); }}
            className="text-xs font-medium text-olive-600 hover:text-olive-700"
          >
            Change file
          </button>
        </div>
      </GlassCard>

      {/* Loading */}
      {isVerifying && (
        <GlassCard className="text-center py-12">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-olive-200 border-t-olive-600" />
          <p className="mt-3 text-sm text-stone-500">Verifying document…</p>
        </GlassCard>
      )}

      {/* Error state */}
      {report && report.error && (
        <GlassCard className="border-amber-300/50 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <FileWarning className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Verification Issue</h3>
              <p className="text-sm text-stone-500">{report.error}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Full report */}
      {report && !report.error && (
        <>
          {/* Overall status */}
          <GlassCard
            className={cn(
              report.isValid
                ? "border-olive-300/50 bg-olive-50/50"
                : "border-red-300/50 bg-red-50/50"
            )}
          >
            <div className="flex items-center gap-3">
              {report.isValid ? (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-olive-100 text-olive-600">
                  <ShieldCheck className="size-6" />
                </div>
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <ShieldAlert className="size-6" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {report.isValid ? "All Signatures Valid" : "Signature Issues Detected"}
                </h3>
                <p className="text-sm text-stone-500">
                  {report.signatureCount} signature{report.signatureCount !== 1 ? "s" : ""} found
                  {report.isCertified && " · Document is certified"}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Certification badge */}
          {report.isCertified && (
            <GlassCard className="border-blue-200/50 bg-blue-50/30">
              <div className="flex items-center gap-3">
                <BadgeCheck className="size-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-stone-900">Certified Document</p>
                  <p className="text-xs text-stone-500">
                    Permission level: {report.certificationLevel === "no_changes" ? "No changes allowed" : report.certificationLevel === "form_fill" ? "Form filling allowed" : "Annotations allowed"}
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Tampering warning */}
          {report.modifiedAfterSigning && (
            <GlassCard className="border-red-200/50 bg-red-50/30">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Document Modified After Signing</p>
                  <p className="text-xs text-red-600">
                    The PDF was edited after the last signature was applied.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Signer details */}
          {report.signers.map((signer, i) => (
            <SignerCard key={i} signer={signer} index={i} total={report.signers.length} />
          ))}
        </>
      )}
    </div>
  );
}

/* ── Signer detail card ── */
function SignerCard({ signer, index, total }: { signer: ISignerVerification; index: number; total: number }) {
  const rows = [
    { icon: User, label: "Signer", value: signer.name },
    ...(signer.organization ? [{ icon: Building2, label: "Organization", value: signer.organization }] : []),
    ...(signer.email ? [{ icon: Mail, label: "Email", value: signer.email }] : []),
    { icon: Clock, label: "Signed At", value: new Date(signer.signedAt).toLocaleString() },
    { icon: KeyRound, label: "Issuer", value: signer.issuer },
    { icon: Hash, label: "Serial Number", value: signer.serialNumber },
    { icon: Clock, label: "Valid From", value: new Date(signer.validFrom).toLocaleDateString() },
    { icon: Clock, label: "Valid To", value: new Date(signer.validTo).toLocaleDateString() },
  ];

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-stone-900">
          Signer {total > 1 ? `${index + 1} of ${total}` : "Details"}
        </h4>
        <div className="flex gap-1.5">
          {signer.isSignatureValid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-olive-100 px-2 py-0.5 text-[10px] font-medium text-olive-700">
              <ShieldCheck className="size-3" /> Valid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              <ShieldAlert className="size-3" /> Invalid
            </span>
          )}
          {signer.isCertificateExpired && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Expired
            </span>
          )}
          {signer.isTampered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              <AlertTriangle className="size-3" /> Tampered
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
            {signer.coverageStatus === "full" ? "Full coverage" : "Partial coverage"}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
              <row.icon className="size-3.5 text-stone-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400">{row.label}</p>
              <p className="text-sm font-medium text-stone-700">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
