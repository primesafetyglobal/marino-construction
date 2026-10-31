import type { Metadata } from "next";
import { SetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Accept your invite", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Welcome to Marino</h1>
      <p className="mb-6 text-sm text-muted">Choose a password for your staff account.</p>
      <SetPasswordForm token={token} mode="invite" />
    </>
  );
}
