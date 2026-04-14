"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  FileSignature,
  ShieldCheck,
  Eye,
  Send,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Download,
  UserPlus,
  X,
  ImageIcon,
  Files,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ISignatureZone, ICertificateInfo } from "@/types";
import { EButtonSize } from "@/types";
import { UploadZone } from "@/components/shared/upload-zone";
import { GlassCard } from "@/components/shared/glass-card";
import { FormButton } from "@/components/shared/form-button";
import { FormInput } from "@/components/shared/form-input";
import { SigningViewerDynamic as SigningViewer } from "@/components/pdf/SigningViewerDynamic";
import { CertificateAuth, SigningSteps, ZonesPanel } from "@/components/signing";
import axios from "axios";
import {
  signPdfApi,
  bulkSignPdfApi,
  downloadSignedPdf,
  downloadBulkSignedZip,
} from "@/services/signing-api";
import type { PdfSignPayload } from "@/services/signing-api";

const STEPS = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "place", label: "Place Zones", icon: FileSignature },
  { id: "authenticate", label: "Authenticate", icon: ShieldCheck },
  { id: "review", label: "Review & Sign", icon: Eye },
];

type SigningMode = "single" | "bulk";

export function AuthSignClient() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<SigningMode>("single");

  // Document
  const [file, setFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);

  // Signature zones
  const [zones, setZones] = useState<ISignatureZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Certificate auth
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certInfo, setCertInfo] = useState<ICertificateInfo | null>(null);
  const [certPassword, setCertPassword] = useState<string>("");
  const [isCertVerified, setIsCertVerified] = useState(false);

  // Signing
  const [isSigning, setIsSigning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Signature image
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [signatureImagePreview, setSignatureImagePreview] = useState<string | null>(null);

  // Abort controller
  const abortRef = useRef<AbortController | null>(null);

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setZones([]);
    setSelectedZoneId(null);
    setStep(1);
  }, []);

  const handleRemoveBulkFile = useCallback((idx: number) => {
    setBulkFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // If reference file was removed, update it
      if (idx === 0) setFile(next[0] ?? null);
      if (next.length === 0) setFile(null);
      return next;
    });
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setBulkFiles([]);
    setZones([]);
    setSelectedZoneId(null);
    setCertFile(null);
    setCertInfo(null);
    setCertPassword("");
    setIsCertVerified(false);
    setIsComplete(false);
    setSignatureImage(null);
    setSignatureImagePreview(null);
    setSignedBlob(null);
    setBulkProgress(null);
    setMode("single");
    setStep(0);
  }, []);

  const handleCertVerified = useCallback((info: ICertificateInfo, password: string) => {
    setCertInfo(info);
    setCertPassword(password);
    setIsCertVerified(true);
  }, []);

  const handleClearCert = useCallback(() => {
    setCertFile(null);
    setCertInfo(null);
    setCertPassword("");
    setIsCertVerified(false);
  }, []);

  const handleSignatureImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSignatureImage(f);
    const reader = new FileReader();
    reader.onload = () => setSignatureImagePreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleClearSignatureImage = useCallback(() => {
    setSignatureImage(null);
    setSignatureImagePreview(null);
  }, []);

  const handleSign = async () => {
    if (!file || zones.length === 0 || !isCertVerified || !certFile) return;
    setIsSigning(true);
    setSignError(null);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const zone = zones[0];
      const payload: PdfSignPayload = {
        SignerID: certInfo?.commonName ?? "Signer",
        docID: file.name,
        is_SigningInfoShown: true,
        is_SignatureVisible: true,
        height: Math.round(zone.height),
        width: Math.round(zone.width),
        offsetX: Math.round(zone.x),
        offsetY: Math.round(zone.y),
        page: zone.pageIndex,
        password: certPassword,
      };

      if (mode === "bulk" && bulkFiles.length > 0) {
        // ── Bulk signing ──
        setBulkProgress({ done: 0, total: bulkFiles.length });
        const zipBlob = await bulkSignPdfApi({
          payload,
          pfx: certFile,
          pdfs: bulkFiles,
          image: signatureImage,
          signal: ac.signal,
          onProgress: (done, total) => setBulkProgress({ done, total }),
        });
        setSignedBlob(zipBlob);
      } else {
        // ── Single signing ──
        const blob = await signPdfApi({
          payload,
          pfx: certFile,
          pdf: file,
          image: signatureImage,
          signal: ac.signal,
        });
        setSignedBlob(blob);
      }

      setIsComplete(true);
      setStep(4);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error("Signing error:", err);
      setSignError(err instanceof Error ? err.message : "Signing failed.");
    } finally {
      setIsSigning(false);
      abortRef.current = null;
    }
  };

  const handleDownloadSigned = () => {
    if (!signedBlob) return;
    if (mode === "bulk") {
      downloadBulkSignedZip(signedBlob, file?.name.replace(/\.pdf$/i, ""));
    } else if (file) {
      downloadSignedPdf(signedBlob, file.name);
    }
  };

  const canProceed = (s: number) => {
    if (s === 0) return !!file;
    if (s === 1) return zones.length > 0;
    if (s === 2) return isCertVerified;
    return false;
  };

  // Step 0: Upload
  if (step === 0) {
    return (
      <div className="space-y-6">
        <SigningSteps steps={STEPS} currentStep={0} />
        <div className="mx-auto max-w-xl space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-stone-100/70 p-1">
            <button
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                mode === "single"
                  ? "bg-white text-olive-700 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              )}
              onClick={() => setMode("single")}
            >
              <FileText className="mr-1.5 inline-block size-4" />
              Single Document
            </button>
            <button
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                mode === "bulk"
                  ? "bg-white text-olive-700 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              )}
              onClick={() => setMode("bulk")}
            >
              <Files className="mr-1.5 inline-block size-4" />
              Bulk Sign
            </button>
          </div>

          {/* Upload area */}
          {mode === "single" ? (
            <UploadZone onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-4">
              {/* Single drop zone – multi-select; first file = reference */}
              <label
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300",
                  "bg-white/40 px-6 py-12 cursor-pointer backdrop-blur-sm",
                  "transition-all duration-200 hover:border-olive-500 hover:bg-olive-50/30",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <Upload className="size-5" />
                </div>
                <p className="text-sm text-stone-500 text-center">Drop your PDFs here or click to upload</p>
                <p className="text-xs text-stone-400">Select all documents at once · first file is used for zone placement</p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (!selected.length) return;
                    const merged = [...bulkFiles, ...selected];
                    setBulkFiles(merged);
                    if (!file) {
                      setFile(merged[0]);
                      setZones([]);
                      setSelectedZoneId(null);
                    }
                    e.target.value = "";
                  }}
                />
              </label>

              {/* File list */}
              {bulkFiles.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-stone-200/60 bg-white/40 p-2">
                  {bulkFiles.map((bf, idx) => (
                    <div key={`${bf.name}-${idx}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50">
                      <FileText className="size-3.5 text-stone-400 shrink-0" />
                      <span className="flex-1 truncate text-xs text-stone-700">
                        {bf.name}
                        {idx === 0 && <span className="ml-1.5 text-[10px] text-olive-600 font-medium">(reference)</span>}
                      </span>
                      <span className="text-[10px] text-stone-400 shrink-0">{(bf.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => handleRemoveBulkFile(idx)} className="text-stone-300 hover:text-red-500">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Proceed */}
              {bulkFiles.length > 0 && (
                <FormButton
                  label={`Continue with ${bulkFiles.length} document${bulkFiles.length !== 1 ? "s" : ""}`}
                  icon={ArrowRight}
                  size={EButtonSize.Large}
                  className="w-full bg-olive-700 hover:bg-olive-600 text-white"
                  onClick={() => setStep(1)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 4: Complete
  if (isComplete) {
    return (
      <div className="space-y-6">
        <SigningSteps steps={STEPS} currentStep={4} />
        <div className="mx-auto max-w-lg text-center">
          <GlassCard>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-olive-100">
                <CheckCircle2 className="size-8 text-olive-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  {mode === "bulk" ? "Bulk Signing Complete" : "Document Signed Successfully"}
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  {mode === "bulk"
                    ? `${bulkFiles.length} documents have been digitally signed and packaged as a zip.`
                    : "Your document has been digitally signed with your certificate."}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <FormButton
                  label={mode === "bulk" ? "Download Signed ZIP" : "Download Signed PDF"}
                  icon={Download}
                  size={EButtonSize.Large}
                  className="w-full bg-olive-700 hover:bg-olive-600 text-white"
                  onClick={handleDownloadSigned}
                />
                <FormButton
                  label="Invite Others to Sign"
                  icon={UserPlus}
                  size={EButtonSize.Medium}
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowInviteModal(true)}
                />
                <FormButton
                  label="Sign Another Document"
                  icon={FileSignature}
                  size={EButtonSize.Medium}
                  variant="ghost"
                  className="w-full"
                  onClick={handleRemoveFile}
                />
              </div>
            </div>
          </GlassCard>
        </div>

        {showInviteModal && (
          <InviteModal onClose={() => setShowInviteModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SigningSteps steps={STEPS} currentStep={step} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Main area */}
        <div className="min-h-125">
          {file && (
            <SigningViewer
              file={file}
              zones={zones}
              selectedZoneId={selectedZoneId}
              onZonesChange={setZones}
              onSelectZone={setSelectedZoneId}
              onRemoveFile={handleRemoveFile}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Step 1: Place zones */}
          {step === 1 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Place Signature Zones</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Click on the document where signatures should appear. Drag to move, resize from corners.
              </p>
              <ZonesPanel
                zones={zones}
                selectedId={selectedZoneId}
                onSelect={setSelectedZoneId}
                onDelete={(id) => {
                  setZones((z) => z.filter((zone) => zone.id !== id));
                  if (selectedZoneId === id) setSelectedZoneId(null);
                }}
              />
            </GlassCard>
          )}

          {/* Step 2: Certificate */}
          {step === 2 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Digital Certificate</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Upload and verify your .pfx certificate to authorize the signature.
              </p>
              <CertificateAuth
                certificateFile={certFile}
                certificateInfo={certInfo}
                isVerified={isCertVerified}
                onCertificateChange={setCertFile}
                onCertificateVerified={handleCertVerified}
                onClear={handleClearCert}
              />
            </GlassCard>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Review & Sign</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Review your signature placement and certificate details before signing.
              </p>

              <div className="space-y-3">
                <ReviewItem label="Document" value={file?.name ?? ""} />
                {mode === "bulk" && bulkFiles.length > 0 && (
                  <ReviewItem label="Batch" value={`${bulkFiles.length} additional document${bulkFiles.length !== 1 ? "s" : ""}`} />
                )}
                <ReviewItem label="Zones" value={`${zones.length} signature zone${zones.length !== 1 ? "s" : ""}`} />
                <ReviewItem label="Certificate" value={certInfo?.commonName ?? ""} />
                <ReviewItem label="Issuer" value={certInfo?.issuer ?? ""} />

                {/* Signature Image Upload (optional) */}
                <div className="rounded-lg border border-stone-200/60 bg-white/40 px-3 py-2">
                  <span className="text-[11px] font-medium text-stone-500 mb-1.5 block">Signature Image (optional)</span>
                  {signatureImagePreview ? (
                    <div className="relative inline-block">
                      <Image src={signatureImagePreview} alt="Signature" width={96} height={48} className="h-12 w-auto rounded border border-stone-200" />
                      <button
                        type="button"
                        onClick={handleClearSignatureImage}
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white/60 px-3 py-2 text-[11px] text-stone-500 transition hover:border-olive-400 hover:bg-olive-50/40">
                      <ImageIcon className="size-4 text-stone-400" />
                      Upload hand-signature image
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleSignatureImageChange} />
                    </label>
                  )}
                </div>

                <button
                  onClick={handleSign}
                  disabled={isSigning}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive-700 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-olive-600 hover:shadow-lg disabled:opacity-60"
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {bulkProgress
                        ? `Signing ${bulkProgress.done}/${bulkProgress.total}…`
                        : "Signing document…"}
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {mode === "bulk" ? "Sign All Documents" : "Sign Document"}
                    </>
                  )}
                </button>

                {signError && (
                  <div className="rounded-lg bg-red-50/80 border border-red-200/60 px-3 py-2 text-[11px] text-red-700">
                    {signError}
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* Navigation */}
          <div className="flex gap-2">
            {step > 1 && (
              <FormButton
                label="Back"
                icon={ArrowLeft}
                size={EButtonSize.Medium}
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => s - 1)}
              />
            )}
            {step < 3 && (
              <FormButton
                label="Continue"
                icon={ArrowRight}
                size={EButtonSize.Medium}
                disabled={!canProceed(step)}
                className={cn(
                  "flex-1",
                  canProceed(step)
                    ? "bg-olive-700 hover:bg-olive-600 text-white"
                    : ""
                )}
                onClick={() => setStep((s) => s + 1)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-200/60 bg-white/40 px-3 py-2">
      <span className="text-[11px] font-medium text-stone-500">{label}</span>
      <span className="text-[11px] font-medium text-stone-800 truncate max-w-37.5">{value}</span>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md bg-white/90">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-900">Invite Signers</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <FormInput
            name="inviteEmail"
            label="Email Address"
            type="email"
            placeholder="colleague@example.com"
          />
          <FormButton
            label="Send Invitation"
            icon={UserPlus}
            size={EButtonSize.Medium}
            className="w-full bg-olive-700 hover:bg-olive-600 text-white"
            onClick={onClose}
          />
        </div>
      </GlassCard>
    </div>
  );
}
