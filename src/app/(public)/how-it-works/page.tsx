import Link from "next/link";
import {
  Upload,
  PenTool,
  Download,
  ShieldCheck,
  FileSignature,
  ArrowRight,
  Workflow,
} from "lucide-react";
import { GlassCard } from "@/components/shared";

const steps = [
  {
    step: 1,
    icon: Upload,
    title: "Upload Your Document",
    description:
      "Drag and drop or browse to upload your PDF. We support files up to 25MB. Your file is encrypted during upload.",
  },
  {
    step: 2,
    icon: PenTool,
    title: "Place Your Signature",
    description:
      "Choose your signature style — draw, type, or upload. Place it anywhere on the document with drag and drop positioning.",
  },
  {
    step: 3,
    icon: Download,
    title: "Sign & Download",
    description:
      "Apply your PKI digital signature. Download the signed PDF instantly — the certificate is embedded in the file.",
  },
  {
    step: 4,
    icon: ShieldCheck,
    title: "Verify (Optional)",
    description:
      "Anyone can verify your signed document. Upload the PDF and get instant validation of the signature, signer identity, and timestamp.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-olive-50/80 via-stone-100 to-lime-50/40" />
        <div className="absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-olive-200/30 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700 backdrop-blur-sm">
              <Workflow className="size-3.5" />
              Simple Process
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              How <span className="text-gradient-olive">Veriza</span> Works
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-stone-500">
              From upload to signed document in under a minute. No software to
              install, no training required.
            </p>
          </div>
        </div>
      </section>

      {/* Steps timeline */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-2xl space-y-8">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 h-full w-px bg-olive-200 sm:left-8" />

            {steps.map((s) => (
              <div key={s.step} className="relative flex gap-5 sm:gap-6">
                <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-olive-600 text-white shadow-md shadow-olive-600/20 sm:size-16">
                  <s.icon className="size-5 sm:size-6" />
                </div>
                <GlassCard className="flex-1">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-olive-600">
                    Step {s.step}
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">
                    {s.description}
                  </p>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl gradient-olive px-6 py-16 text-center sm:px-12">
            <div className="absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                See It in Action
              </h2>
              <p className="mt-4 text-base text-olive-100/90">
                Upload a document and experience the signing process yourself.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/sign"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-olive-700 shadow-lg transition-all hover:bg-olive-50"
                >
                  <FileSignature className="size-4" />
                  Try It Now
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                >
                  View All Services
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
