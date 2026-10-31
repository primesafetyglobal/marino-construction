import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Confirm your new email</h1>
      <p className="mb-6 text-sm text-muted">The new address is saved only after you confirm it.</p>
      <VerifyEmailForm token={token} />
    </>
  );
}
