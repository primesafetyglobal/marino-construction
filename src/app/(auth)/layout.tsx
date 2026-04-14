import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden w-1/2 items-center justify-center gradient-olive lg:flex">
        <div className="max-w-sm text-center">
          <Image
            src="/logos/logo.png"
            alt="Veriza"
            width={64}
            height={64}
            className="mx-auto mb-6 size-16"
          />
          <h2 className="text-2xl font-bold text-white">
            Secure Digital Signing
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-olive-100/80">
            Sign, verify, and manage documents with PKI-powered security. Trusted
            by individuals and organizations worldwide.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <Image
            src="/logos/logo.png"
            alt="Veriza"
            width={32}
            height={32}
            className="size-8"
          />
          <span className="text-xl font-bold text-stone-900">Veriza</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
