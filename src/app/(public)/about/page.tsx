import { Target, Heart, Shield } from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/shared";

const values = [
  {
    icon: Shield,
    title: "Security First",
    description:
      "Every decision we make starts with security. PKI-powered signatures ensure your documents are tamper-proof.",
  },
  {
    icon: Heart,
    title: "Accessible to Everyone",
    description:
      "We believe digital signing should be simple, affordable, and accessible to individuals and organizations alike.",
  },
  {
    icon: Target,
    title: "Trust & Transparency",
    description:
      "Open verification, audit trails, and clear pricing. We build trust through transparency.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700">
              <Shield className="size-3.5" />
              About Veriza
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Making Digital Signing{" "}
              <span className="text-gradient-olive">Secure & Simple</span>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-stone-500">
              Veriza was built with a simple mission: make legally valid digital signing
              accessible to everyone. Whether you are an individual signing a contract or
              an organization managing thousands of documents, we provide the security and
              simplicity you need.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Why We Built Veriza"
            subtitle="Digital signing shouldn't require expensive software, technical expertise, or compromises on security."
          />
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm leading-relaxed text-stone-500">
              Traditional signing is slow, expensive, and insecure. Paper documents get
              lost, faxed signatures can be forged, and most electronic signature tools
              lack real cryptographic security. We set out to change that by building a
              platform that combines the convenience of modern e-signatures with the
              security of PKI digital certificates.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Our Values" />
          <div className="grid gap-6 sm:grid-cols-3">
            {values.map((v) => (
              <GlassCard key={v.title} hover className="text-center">
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <v.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {v.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
