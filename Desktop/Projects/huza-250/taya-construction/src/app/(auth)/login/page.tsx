import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Staff login", robots: { index: false } };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Staff login</h1>
      <p className="mb-6 text-sm text-muted">For Marino staff only.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
