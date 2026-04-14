"use client";

import { useState } from "react";
import { Save, Lock, Bell, FileKey, ShieldCheck, Trash2, Upload } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { FormInput } from "@/components/shared/form-input";
import { FormButton } from "@/components/shared/form-button";
import { FormCheckbox } from "@/components/shared/form-checkbox";
import { EButtonSize } from "@/types";
import type { ICertificateInfo } from "@/types";
import { parsePfxCertificate } from "@/services/signing";

export function ProfileClient() {
  const [isSaving, setIsSaving] = useState(false);
  const [savedCert, setSavedCert] = useState<ICertificateInfo | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certError, setCertError] = useState<string | null>(null);
  const [isVerifyingCert, setIsVerifyingCert] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Personal Info */}
      <GlassCard>
        <h3 className="mb-4 text-base font-semibold text-stone-900">Personal Information</h3>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput name="firstName" label="First Name" placeholder="John" />
            <FormInput name="lastName" label="Last Name" placeholder="Doe" />
          </div>
          <FormInput name="email" label="Email" type="email" placeholder="john@example.com" disabled />
          <FormInput name="organization" label="Organization (optional)" placeholder="Acme Inc." />
          <FormButton
            label="Save Changes"
            icon={Save}
            size={EButtonSize.Medium}
            isLoading={isSaving}
            onClick={handleSave}
            className="bg-olive-700 hover:bg-olive-600 text-white"
          />
        </div>
      </GlassCard>

      {/* Password */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="size-4 text-stone-500" />
          <h3 className="text-base font-semibold text-stone-900">Change Password</h3>
        </div>
        <div className="space-y-4">
          <FormInput name="currentPassword" label="Current Password" type="password" placeholder="Enter current password" />
          <FormInput name="newPassword" label="New Password" type="password" placeholder="Enter new password" />
          <FormInput name="confirmPassword" label="Confirm New Password" type="password" placeholder="Confirm new password" />
          <FormButton
            label="Update Password"
            icon={Lock}
            size={EButtonSize.Medium}
            variant="outline"
          />
        </div>
      </GlassCard>

      {/* Notifications */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="size-4 text-stone-500" />
          <h3 className="text-base font-semibold text-stone-900">Notification Settings</h3>
        </div>
        <div className="space-y-3">
          <FormCheckbox name="emailOnSign" label="Email me when a document is signed" />
          <FormCheckbox name="emailOnInvite" label="Email me when I receive a signing invitation" />
          <FormCheckbox name="emailOnVerify" label="Email me when a document is verified" />
          <FormCheckbox name="marketingEmails" label="Receive product updates and tips" />
        </div>
      </GlassCard>

      {/* Digital Certificate Management */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <FileKey className="size-4 text-stone-500" />
          <h3 className="text-base font-semibold text-stone-900">Digital Certificate</h3>
        </div>

        {savedCert ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-olive-200/60 bg-olive-50/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="size-3.5 text-olive-600" />
                <span className="font-medium text-stone-700">{savedCert.commonName}</span>
              </div>
              {savedCert.organization && (
                <p className="text-[11px] text-stone-500 pl-5.5">{savedCert.organization}</p>
              )}
              <p className="text-[11px] text-stone-500 pl-5.5">
                Issuer: {savedCert.issuer}
              </p>
              <p className="text-[11px] text-stone-500 pl-5.5">
                Valid until: {new Date(savedCert.validTo).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => {
                setSavedCert(null);
                setCertFile(null);
                setCertPassword("");
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="size-3.5" />
              Remove certificate
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Upload your .pfx or .p12 certificate to enable digital signing.
            </p>

            {!certFile ? (
              <label className="group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-white/40 px-4 py-4 transition-all hover:border-olive-400 hover:bg-olive-50/30">
                <div className="flex size-9 items-center justify-center rounded-lg bg-stone-100 group-hover:bg-olive-100 transition-colors">
                  <Upload className="size-4 text-stone-400 group-hover:text-olive-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-600">Upload certificate</p>
                  <p className="text-[10px] text-stone-400">.pfx or .p12 files</p>
                </div>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setCertFile(f);
                      setCertError(null);
                    }
                  }}
                  className="sr-only"
                />
              </label>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white/60 p-2.5">
                  <FileKey className="size-4 text-olive-600" />
                  <span className="flex-1 truncate text-xs font-medium text-stone-700">{certFile.name}</span>
                  <button
                    onClick={() => { setCertFile(null); setCertPassword(""); setCertError(null); }}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <FormInput
                  name="certPassword"
                  label="Certificate Password"
                  type="password"
                  placeholder="Enter certificate password"
                />
                {certError && (
                  <p className="text-[11px] text-red-500">{certError}</p>
                )}
                <FormButton
                  label={isVerifyingCert ? "Verifying…" : "Save Certificate"}
                  icon={ShieldCheck}
                  size={EButtonSize.Medium}
                  isLoading={isVerifyingCert}
                  className="bg-olive-700 hover:bg-olive-600 text-white"
                  onClick={async () => {
                    if (!certFile) return;
                    setIsVerifyingCert(true);
                    setCertError(null);
                    try {
                      const buf = await certFile.arrayBuffer();
                      const passEl = document.querySelector<HTMLInputElement>('input[name="certPassword"]');
                      const pw = passEl?.value ?? certPassword;
                      const info = await parsePfxCertificate(buf, pw);
                      setSavedCert(info);
                      setCertPassword(pw);
                    } catch (err) {
                      setCertError(err instanceof Error ? err.message : "Verification failed.");
                    } finally {
                      setIsVerifyingCert(false);
                    }
                  }}
                />
              </>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
