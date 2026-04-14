"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { FormInput } from "@/components/shared/form-input";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSent(true);
    }, 1500);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-olive-100 text-olive-600">
          <Mail className="size-5" />
        </div>
        <h3 className="text-lg font-semibold text-stone-900">Check your email</h3>
        <p className="mt-2 text-sm text-stone-500">
          We&apos;ve sent a password reset link to your email address.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        required
      />
      <FormButton
        type="submit"
        label="Send Reset Link"
        icon={Mail}
        size={EButtonSize.Large}
        isLoading={isLoading}
        className="w-full bg-olive-700 hover:bg-olive-600 text-white"
      />
    </form>
  );
}
