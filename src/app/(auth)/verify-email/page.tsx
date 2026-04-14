"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false);

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-olive-100 text-olive-600">
        <Mail className="size-6" />
      </div>
      <h1 className="text-2xl font-bold text-stone-900">Verify your email</h1>
      <p className="mt-2 text-sm text-stone-500 leading-relaxed">
        We&apos;ve sent a verification link to your email address. Please check
        your inbox and click the link to activate your account.
      </p>

      {resent && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-olive-600">
          <CheckCircle2 className="size-4" />
          Email resent successfully
        </div>
      )}

      <div className="mt-6">
        <FormButton
          label="Resend Verification Email"
          icon={Mail}
          size={EButtonSize.Medium}
          onClick={() => setResent(true)}
          variant="outline"
          className="mx-auto"
        />
      </div>
    </div>
  );
}
