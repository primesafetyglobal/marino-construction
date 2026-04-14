import { Lock, Shield, ScrollText, Scale, KeyRound, Database } from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/shared";
import { SecurityFaq } from "@/components/public/security-faq";

const securityFeatures = [
  {
    icon: KeyRound,
    title: "PKI Digital Signatures",
    description:
      "Every signature uses public key infrastructure with X.509 certificates, ensuring authenticity and non-repudiation.",
  },
  {
    icon: Lock,
    title: "SHA-256 Encryption",
    description:
      "Documents are hashed with SHA-256 before signing. Any modification after signing is immediately detectable.",
  },
  {
    icon: ScrollText,
    title: "Audit Logs",
    description:
      "Every signing event is logged with timestamps, IP addresses, and signer identity for full traceability.",
  },
  {
    icon: Scale,
    title: "Legal Compliance",
    description:
      "Compliant with eIDAS, ESIGN Act, and UETA. Our signatures are legally binding in most jurisdictions.",
  },
  {
    icon: Database,
    title: "Secure Storage",
    description:
      "Documents are encrypted at rest and in transit. Access controls ensure only authorized users can view documents.",
  },
  {
    icon: Shield,
    title: "Tamper Detection",
    description:
      "Built-in integrity verification. If a signed document is altered, the signature is automatically invalidated.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Security You Can Trust"
            subtitle="Enterprise-grade security for every document you sign."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {securityFeatures.map((f) => (
              <GlassCard key={f.title} hover>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-stone-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {f.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white/40">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Security FAQs" />
          <SecurityFaq />
        </div>
      </section>
    </>
  );
}
