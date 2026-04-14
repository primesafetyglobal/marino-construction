"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { FormInput } from "@/components/shared/form-input";
import { FormCheckbox } from "@/components/shared/form-checkbox";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        placeholder="Enter your password"
        required
      />
      <div className="flex items-center justify-between">
        <FormCheckbox name="rememberMe" label="Remember me" />
        <Link
          href="/reset-password"
          className="text-xs font-medium text-olive-600 hover:text-olive-700"
        >
          Forgot password?
        </Link>
      </div>
      <FormButton
        type="submit"
        label="Log In"
        icon={LogIn}
        size={EButtonSize.Large}
        isLoading={isLoading}
        className="w-full bg-olive-700 hover:bg-olive-600 text-white"
      />
    </form>
  );
}
