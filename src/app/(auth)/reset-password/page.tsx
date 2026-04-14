import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Reset password</h1>
      <p className="mt-1 text-sm text-stone-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-stone-500">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-olive-600 hover:text-olive-700"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
