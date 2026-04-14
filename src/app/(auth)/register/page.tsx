import Link from "next/link";
import { RegisterForm } from "@/components/forms/register-form";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Create your account</h1>
      <p className="mt-1 text-sm text-stone-500">
        Start signing documents securely with Veriza.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-stone-500">
        Already have an account?{" "}
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
