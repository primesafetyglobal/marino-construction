"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  KeyRound,
  FileText,
  Save,
  History,
  Building2,
  Mail,
  Hash,
  AlertTriangle,
  BadgeCheck,
  FileWarning,
} from "lucide-react";
import { UploadZone } from "@/components/shared/upload-zone";
import { GlassCard } from "@/components/shared/glass-card";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";
import type { IVerificationReport, ISignerVerification } from "@/types";
import { verifyDocument } from "@/actions/verify-document";

interface VerificationRecord {
  fileName: string;
  isValid: boolean;
  signerName: string;
  timestamp: string;
}

export function AuthVerifyClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [report, setReport] = useState<IVerificationReport | null>(null);
  const [history, setHistory] = useState<VerificationRecord[]>([]);

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setReport(null);
    setIsVerifying(true);

    try {
      const formData = new FormData();
      formData.append("file", f, f.name);

      const result = await verifyDocument(formData);

      console.log("=== VERIFICATION REPORT ===");
      console.log("Valid:", result.isValid);
      console.log("Certified:", result.isCertified);
      console.log("Certification Level:", result.certificationLevel ?? "N/A");
      console.log("Signature Count:", result.signatureCount);
      console.log("Modified After Signing:", result.modifiedAfterSigning);
      console.log("Signers:", result.signers);
      if (result.error) console.error("Error:", result.error);
      console.log("===========================");

      setReport(result);

      // Add to local history
      setHistory((prev) => [
        {
          fileName: f.name,
          isValid: result.isValid,
          signerName: result.signers[0]?.name ?? "Unknown",
          timestamp: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        },
        ...prev,
      ]);
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

  return (
    <div className="space-y-8">
      {/* Upload / Result */}
      {!file ? (
        <div className="mx-auto max-w-xl">
          <UploadZone label="Drop a signed PDF to verify" onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* File bar */}
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
                Change
              </button>
            </div>
          </GlassCard>

          {/* Loading */}
          {isVerifying && (
            <GlassCard className="text-center py-12">
              <div className="mx-auto size-8 animate-spin rounded-full border-2 border-olive-200 border-t-olive-600" />
              <p className="mt-3 text-sm text-stone-500">Verifying signatures…</p>
            </GlassCard>
          )}

          {/* Error: no signatures */}
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

          {/* Report */}
          {report && !report.error && (
            <>
              {/* Overall status */}
              <GlassCard className={report.isValid ? "border-olive-300/50 bg-olive-50/50" : "border-red-300/50 bg-red-50/50"}>
                <div className="flex items-center gap-3">
                  <div className={`flex size-12 items-center justify-center rounded-2xl ${report.isValid ? "bg-olive-100 text-olive-600" : "bg-red-100 text-red-600"}`}>
                    {report.isValid ? <ShieldCheck className="size-6" /> : <ShieldAlert className="size-6" />}
                  </div>
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

              {/* Certification */}
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
                        The PDF was edited after the last signature was applied. The document may have been tampered with.
                      </p>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Each signer */}
              {report.signers.map((signer, i) => (
                <SignerCard key={i} signer={signer} index={i} total={report.signers.length} />
              ))}

              <FormButton
                label="Save Verification"
                icon={Save}
                size={EButtonSize.Medium}
                className="bg-olive-700 hover:bg-olive-600 text-white"
              />
            </>
          )}
        </div>
      )}

      {/* Verification History */}
      {history.length > 0 && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <History className="size-4 text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-900">Verification History</h3>
          </div>
          <div className="space-y-2">
            {history.map((rec, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-white/40 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {rec.isValid ? (
                    <ShieldCheck className="size-4 shrink-0 text-olive-500" />
                  ) : (
                    <ShieldAlert className="size-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-700">{rec.fileName}</p>
                    <p className="text-xs text-stone-400">{rec.signerName}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-stone-400">{rec.timestamp}</span>
              </div>
            ))}
          </div>
        </GlassCard>
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
