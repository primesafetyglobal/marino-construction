import Link from "next/link";
import {
  FileSignature,
  Upload,
  PenTool,
  Download,
  Shield,
  UserCheck,
  Zap,
  Building2,
  GraduationCap,
  Landmark,
  ArrowRight,
  ShieldCheck,
  Files,
} from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/shared";

const steps = [
  {
    icon: Upload,
    title: "Upload Document",
    description:
      "Upload your PDF document securely. Files are encrypted in transit and processed on-demand.",
  },
  {
    icon: PenTool,
    title: "Place Your Signature",
    description:
      "Position your digital signature precisely on the document. Adjust size and placement as needed.",
  },
  {
    icon: Download,
    title: "Download Signed Copy",
    description:
      "Receive your signed document instantly. The PKI signature is embedded and independently verifiable.",
  },
];

const benefits = [
  {
    icon: UserCheck,
    title: "No Account Required",
    description:
      "Sign documents immediately without registration. For advanced features, create a free account.",
  },
  {
    icon: Shield,
    title: "Legally Binding Signatures",
    description:
      "Every signature is backed by PKI certificates, meeting international standards for digital signatures.",
  },
  {
    icon: Zap,
    title: "Enterprise-Grade Security",
    description:
      "X.509 certificates and cryptographic hashing ensure document integrity and signer authentication.",
  },
];

const services = [
  {
    icon: FileSignature,
    title: "Document Signing",
    description:
      "Apply PKI-based digital signatures to individual PDF documents with full control over placement and appearance.",
  },
  {
    icon: Files,
    title: "Bulk Signing",
    description:
      "Process multiple documents in a single batch operation — ideal for organizations handling high volumes of paperwork.",
  },
  {
    icon: ShieldCheck,
    title: "Document Verification",
    description:
      "Verify the authenticity of any signed document. Confirm signer identity and detect unauthorized modifications.",
  },
];

const useCases = [
  {
    icon: Landmark,
    title: "Government & Public Sector",
    description:
      "Digitize administrative workflows, sign ministerial communications, and authenticate official documents.",
  },
  {
    icon: Building2,
    title: "Businesses & Enterprises",
    description:
      "Accelerate contract signing, maintain compliance, and reduce operational overhead from paper-based processes.",
  },
  {
    icon: GraduationCap,
    title: "Education & Professional Bodies",
    description:
      "Issue signed certificates, process academic transcripts, and handle professional licensing documentation.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-olive-50/80 via-stone-100 to-lime-50/40" />
        <div className="absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-olive-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 -z-10 size-96 rounded-full bg-lime-200/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700 backdrop-blur-sm">
              <Shield className="size-3.5" />
              PKI-Powered Digital Signing
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              Sign Documents with{" "}
              <span className="text-gradient-olive">Confidence</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-stone-500 sm:text-xl">
              Veriza delivers secure, legally valid digital signatures backed by
              PKI technology. Trusted by government agencies, financial
              institutions, and enterprises across the region.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/sign"
                className="inline-flex items-center gap-2 rounded-xl bg-olive-700 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-olive-700/25 transition-all hover:bg-olive-600 hover:shadow-xl hover:shadow-olive-600/30"
              >
                <FileSignature className="size-4" />
                Sign a Document
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white/60 px-7 py-3.5 text-sm font-semibold text-stone-700 backdrop-blur-sm transition-all hover:bg-white hover:shadow-sm"
              >
                Create an Account
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="What We Offer"
            subtitle="Core document services built on public key infrastructure."
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {services.map((s) => (
              <GlassCard key={s.title} hover>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <s.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {s.description}
                </p>
              </GlassCard>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-olive-700 transition-colors hover:text-olive-600"
            >
              View All Services
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="How It Works"
            subtitle="Three steps to sign any document securely."
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <GlassCard key={step.title} hover className="text-center">
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <step.icon className="size-5" />
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-olive-600">
                  Step {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {step.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Why Veriza"
            subtitle="Built for professionals and institutions that demand reliability."
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {benefits.map((b) => (
              <GlassCard key={b.title} hover>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <b.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {b.description}
                </p>
              </GlassCard>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="mt-14">
            <GlassCard className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:justify-between">
              {[
                { value: "X.509", label: "Certificate Standard" },
                { value: "256-bit", label: "Encryption" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "< 3s", label: "Average Sign Time" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-olive-700">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-stone-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Trusted Across Sectors"
            subtitle="Veriza serves organizations that require secure, auditable document signing."
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {useCases.map((uc) => (
              <GlassCard key={uc.title} hover>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <uc.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {uc.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {uc.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl gradient-olive px-6 py-16 text-center sm:px-12">
            <div className="absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Ready to Sign Your First Document?
              </h2>
              <p className="mt-4 text-base text-olive-100/90">
                No account needed. Upload a PDF and sign it in under a minute.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/sign"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-olive-700 shadow-lg transition-all hover:bg-olive-50"
                >
                  <FileSignature className="size-4" />
                  Sign Now — Free
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                >
                  Explore Services
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
