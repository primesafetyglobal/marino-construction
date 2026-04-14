import Link from "next/link";
import {
  Zap,
  Shield,
  Brain,
  DollarSign,
  FileSignature,
  ArrowRight,
  Award,
  CheckCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/shared";

const benefits = [
  {
    icon: Zap,
    title: "Speed",
    description:
      "Sign documents in seconds, not days. No printing, scanning, or mailing. Instant turnaround for time-sensitive documents.",
    highlights: [
      "Sign in under 60 seconds",
      "Instant document delivery",
      "No physical mail delays",
    ],
  },
  {
    icon: Shield,
    title: "Security",
    description:
      "Every signature is backed by PKI certificates with SHA-256 encryption. Tamper-proof, verifiable, and compliant.",
    highlights: [
      "PKI digital certificates",
      "SHA-256 encryption",
      "Tamper detection built-in",
    ],
  },
  {
    icon: Brain,
    title: "No Technical Knowledge Needed",
    description:
      "Designed for everyone. Upload, sign, and download — no setup, no training, no technical requirements.",
    highlights: [
      "Intuitive drag & drop interface",
      "Works on any modern browser",
      "No software installation",
    ],
  },
  {
    icon: DollarSign,
    title: "Cost Savings",
    description:
      "Eliminate paper, ink, shipping, and storage costs. Reduce operational overhead and environmental impact.",
    highlights: [
      "Free tier available",
      "No hardware needed",
      "Reduce paper costs significantly",
    ],
  },
];

export default function BenefitsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-olive-50/80 via-stone-100 to-lime-50/40" />
        <div className="absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-olive-200/30 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700 backdrop-blur-sm">
              <Award className="size-3.5" />
              Why Choose Veriza
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              The <span className="text-gradient-olive">Benefits</span> of
              Digital Signing
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-stone-500">
              Faster execution, stronger security, lower costs, and zero
              complexity. Here is why organizations choose Veriza.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <GlassCard key={b.title} hover className="flex flex-col">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <b.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {b.description}
                </p>
                <ul className="mt-4 space-y-2">
                  {b.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 text-sm text-stone-600"
                    >
                      <CheckCircle2 className="size-4 shrink-0 text-olive-600" />
                      {h}
                    </li>
                  ))}
                </ul>
              </GlassCard>
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
                Experience the Difference
              </h2>
              <p className="mt-4 text-base text-olive-100/90">
                Sign your first document for free and see the benefits
                first-hand.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/sign"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-olive-700 shadow-lg transition-all hover:bg-olive-50"
                >
                  <FileSignature className="size-4" />
                  Sign a Document
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                >
                  See How It Works
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
