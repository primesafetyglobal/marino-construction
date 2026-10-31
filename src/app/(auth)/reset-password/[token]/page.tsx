import type { Metadata } from "next";
import { SetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Set a new password</h1>
      <p className="mb-6 text-sm text-muted">Your other sessions will be signed out.</p>
      <SetPasswordForm token={token} mode="reset" />
    </>
  );
}
