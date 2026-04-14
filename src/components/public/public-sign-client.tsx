"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  FileSignature,
  Upload,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Eye,
  Send,
  ShieldCheck,
  ImageIcon,
  X,
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
import { SigningViewerDynamic as SigningViewer } from "@/components/pdf/SigningViewerDynamic";
import { SigningSteps, ZonesPanel } from "@/components/signing";
import { CertificateAuth } from "@/components/signing/CertificateAuth";
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
  { id: "place", label: "Place Zone", icon: FileSignature },
  { id: "certificate", label: "Certificate", icon: ShieldCheck },
  { id: "review", label: "Review & Sign", icon: Eye },
];

type SigningMode = "single" | "bulk";

export function PublicSignClient() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<SigningMode>("single");

  // Single-file state
  const [file, setFile] = useState<File | null>(null);
  // Bulk-file state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);

  const [zones, setZones] = useState<ISignatureZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Certificate state
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certInfo, setCertInfo] = useState<ICertificateInfo | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [isCertVerified, setIsCertVerified] = useState(false);

  // Signature image state
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [signatureImagePreview, setSignatureImagePreview] = useState<string | null>(null);

  // Abort controller for cancellation
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
    setIsComplete(false);
    setCertFile(null);
    setCertInfo(null);
    setCertPassword("");
    setIsCertVerified(false);
    setSignatureImage(null);
    setSignatureImagePreview(null);
    setSignedBlob(null);
    setBulkProgress(null);
    setMode("single");
    setStep(0);
  }, []);

  const handleCertificateChange = useCallback(
    (f: File | null) => {
      setCertFile(f);
      if (!f) {
        setCertInfo(null);
        setCertPassword("");
        setIsCertVerified(false);
      }
    },
    [],
  );

  const handleCertificateVerified = useCallback(
    (info: ICertificateInfo, password: string) => {
      setCertInfo(info);
      setCertPassword(password);
      setIsCertVerified(true);
    },
    [],
  );

  const handleClearCertificate = useCallback(() => {
    setCertFile(null);
    setCertInfo(null);
    setCertPassword("");
    setIsCertVerified(false);
  }, []);

  const handleSignatureImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSignatureImage(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setSignatureImagePreview(url);
    } else {
      setSignatureImagePreview(null);
    }
  }, []);

  const handleClearSignatureImage = useCallback(() => {
    setSignatureImage(null);
    if (signatureImagePreview) URL.revokeObjectURL(signatureImagePreview);
    setSignatureImagePreview(null);
  }, [signatureImagePreview]);

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

        {/* Mode toggle */}
        <div className="mx-auto flex max-w-xl gap-2 rounded-xl bg-stone-100/60 p-1">
          <button
            onClick={() => setMode("single")}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              mode === "single"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700",
            )}
          >
            <FileSignature className="mr-2 inline size-4" />
            Single Document
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              mode === "bulk"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700",
            )}
          >
            <Files className="mr-2 inline size-4" />
            Bulk Sign
          </button>
        </div>

        <div className="mx-auto max-w-xl">
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

  // Complete
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
                  {mode === "bulk" ? "Documents Signed" : "Document Signed"}
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  {mode === "bulk"
                    ? `${bulkFiles.length} document${bulkFiles.length !== 1 ? "s have" : " has"} been digitally signed.`
                    : "Your document has been digitally signed with your PKI certificate."}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <FormButton
                  label={mode === "bulk" ? "Download Signed Archive (.zip)" : "Download Signed PDF"}
                  icon={Download}
                  size={EButtonSize.Large}
                  className="w-full bg-olive-700 hover:bg-olive-600 text-white"
                  onClick={handleDownloadSigned}
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SigningSteps steps={STEPS} currentStep={step} />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
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
              maxZones={1}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Step 1: Place zone */}
          {step === 1 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Place Signature Zone</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Click on the document where the signature should appear. One zone allowed.
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

          {/* Step 2: Certificate authentication */}
          {step === 2 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Authenticate Certificate</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Upload your .pfx digital certificate and verify the password.
              </p>
              <CertificateAuth
                certificateFile={certFile}
                certificateInfo={certInfo}
                isVerified={isCertVerified}
                onCertificateChange={handleCertificateChange}
                onCertificateVerified={handleCertificateVerified}
                onClear={handleClearCertificate}
              />
            </GlassCard>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <GlassCard className="p-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-900">Review & Sign</h4>
              <p className="text-[11px] text-stone-500 mb-3">
                Confirm the details and submit for signing.
              </p>

              <div className="space-y-3">
                <ReviewItem label="Document" value={file?.name ?? ""} />
                {mode === "bulk" && (
                  <ReviewItem label="Batch" value={`${bulkFiles.length} document${bulkFiles.length !== 1 ? "s" : ""}`} />
                )}
                <ReviewItem label="Signature Zone" value={zones.length > 0 ? `Page ${zones[0].pageIndex} — (${Math.round(zones[0].x)}, ${Math.round(zones[0].y)})` : "—"} />
                <ReviewItem label="Certificate" value={certInfo?.commonName ?? certFile?.name ?? "—"} />
                <ReviewItem label="Organization" value={certInfo?.organization ?? "—"} />

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
                        : "Processing…"}
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {mode === "bulk"
                        ? `Sign ${bulkFiles.length} Document${bulkFiles.length !== 1 ? "s" : ""}`
                        : "Sign Document"}
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

/* ── Shared review row ── */
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-200/60 bg-white/40 px-3 py-2">
      <span className="text-[11px] font-medium text-stone-500">{label}</span>
      <span className="text-[11px] font-medium text-stone-800 truncate max-w-37.5">{value}</span>
    </div>
  );
}
