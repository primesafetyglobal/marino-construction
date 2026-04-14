import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Welcome back</h1>
      <p className="mt-1 text-sm text-stone-500">
        Log in to your Veriza account.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-stone-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-olive-600 hover:text-olive-700"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
