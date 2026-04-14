"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { FormInput } from "@/components/shared/form-input";
import { FormCheckbox } from "@/components/shared/form-checkbox";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput
        name="name"
        label="Full Name"
        placeholder="John Doe"
        required
      />
      <FormInput
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        required
      />
      <FormInput
        name="password"
        label="Password"
        type="password"
        placeholder="Create a strong password"
        required
      />
      <FormCheckbox
        name="acceptTerms"
        label={
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-olive-600 hover:text-olive-700 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-olive-600 hover:text-olive-700 underline">
              Privacy Policy
            </Link>
          </span>
        }
      />
      <FormButton
        type="submit"
        label="Create Account"
        icon={UserPlus}
        size={EButtonSize.Large}
        isLoading={isLoading}
        className="w-full bg-olive-700 hover:bg-olive-600 text-white"
      />
    </form>
  );
}
