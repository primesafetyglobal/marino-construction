import Link from "next/link";
import { Logo } from "@/components/public/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mist px-4 py-12">
      <Link href="/" className="mb-8" aria-label="Marino Construction home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-[var(--radius-card)] bg-white p-8 shadow-soft">{children}</div>
      <Link href="/" className="mt-6 text-sm text-muted hover:text-ink">
        Back to the website
      </Link>
    </div>
  );
}
