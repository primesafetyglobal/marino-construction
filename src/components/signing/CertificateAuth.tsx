"use client";

import { useState, useRef } from "react";
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileKey,
  Loader2,
  Trash2,
  Building2,
  Mail,
  Calendar,
  Hash,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ICertificateInfo } from "@/types";
import { parsePfxCertificate } from "@/services/signing";

interface CertificateAuthProps {
  certificateFile: File | null;
  certificateInfo: ICertificateInfo | null;
  isVerified: boolean;
  onCertificateChange: (file: File | null) => void;
  onCertificateVerified: (info: ICertificateInfo, password: string) => void;
  onClear: () => void;
  className?: string;
}

export function CertificateAuth({
  certificateFile,
  certificateInfo,
  isVerified,
  onCertificateChange,
  onCertificateVerified,
  onClear,
  className,
}: CertificateAuthProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".pfx") && !ext.endsWith(".p12")) {
      setError("Please select a .pfx or .p12 certificate file.");
      return;
    }
    setError(null);
    setPassword("");
    onCertificateChange(f);
  };

  const handleVerify = async () => {
    if (!certificateFile || !password.trim()) return;
    setIsVerifying(true);
    setError(null);

    try {
      const buffer = await certificateFile.arrayBuffer();
      const info = await parsePfxCertificate(buffer, password);
      onCertificateVerified(info, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClear = () => {
    setPassword("");
    setError(null);
    onClear();
    if (fileRef.current) fileRef.current.value = "";
  };

  // Verified state — show certificate details
  if (isVerified && certificateInfo) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-olive-100">
            <ShieldCheck className="size-4 text-olive-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-900">Certificate Verified</p>
            <p className="truncate text-[11px] text-stone-500">{certificateFile?.name}</p>
          </div>
          <button
            onClick={handleClear}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Remove certificate"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="rounded-xl border border-olive-200/60 bg-olive-50/40 p-3 space-y-2">
          <InfoRow icon={User} label="Name" value={certificateInfo.commonName} />
          {certificateInfo.organization && (
            <InfoRow icon={Building2} label="Org" value={certificateInfo.organization} />
          )}
          {certificateInfo.email && (
            <InfoRow icon={Mail} label="Email" value={certificateInfo.email} />
          )}
          <InfoRow icon={ShieldCheck} label="Issuer" value={certificateInfo.issuer} />
          <InfoRow
            icon={Calendar}
            label="Valid"
            value={`${new Date(certificateInfo.validFrom).toLocaleDateString()} – ${new Date(certificateInfo.validTo).toLocaleDateString()}`}
          />
          <InfoRow icon={Hash} label="Serial" value={certificateInfo.serialNumber.slice(0, 20) + "…"} />

          {certificateInfo.isValid ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-olive-100 px-2 py-1.5 text-[11px] font-medium text-olive-700">
              <CheckCircle2 className="size-3.5" />
              Certificate is currently valid
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="size-3.5" />
              Certificate has expired
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Upload */}
      {!certificateFile ? (
        <label className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-white/40 px-4 py-6 transition-all hover:border-olive-400 hover:bg-olive-50/30">
          <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100 transition-colors group-hover:bg-olive-100">
            <FileKey className="size-5 text-stone-400 group-hover:text-olive-600" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-stone-600">
              Upload your digital certificate
            </p>
            <p className="mt-0.5 text-[10px] text-stone-400">.pfx or .p12 files</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pfx,.p12"
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>
      ) : (
        <>
          {/* File info */}
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white/60 p-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-olive-100">
              <FileKey className="size-4 text-olive-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-stone-700">{certificateFile.name}</p>
              <p className="text-[10px] text-stone-400">
                {(certificateFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleClear}
              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
              <KeyRound className="size-3" />
              Certificate Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="Enter certificate password"
                className="h-9 w-full rounded-xl border border-stone-300 bg-white/60 pl-3 pr-10 text-sm text-stone-700 placeholder:text-stone-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
              <XCircle className="size-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={!password.trim() || isVerifying}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              !password.trim()
                ? "cursor-not-allowed bg-stone-100 text-stone-400"
                : "bg-olive-700 text-white shadow-sm hover:bg-olive-600 hover:shadow-md"
            )}
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Verify & Unlock Signing
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="size-3 shrink-0 text-olive-500" />
      <span className="shrink-0 font-medium text-stone-500">{label}:</span>
      <span className="truncate text-stone-700">{value}</span>
    </div>
  );
}
