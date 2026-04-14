import Link from "next/link";
import {
  FileSignature,
  Files,
  ShieldCheck,
  KeyRound,
  ClipboardList,
  Code2,
  Clock,
  ArrowRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/shared";

const coreServices = [
  {
    icon: FileSignature,
    title: "Document Signing",
    description:
      "Apply legally binding digital signatures to PDF documents using PKI certificates. Each signature is cryptographically tied to the signer's identity, ensuring authenticity and non-repudiation.",
    features: [
      "X.509 certificate-based signatures",
      "Visible or invisible signature placement",
      "Customizable signature position and size",
      "Instant signed document download",
    ],
    href: "/sign",
    cta: "Sign a Document",
  },
  {
    icon: Files,
    title: "Bulk Signing",
    description:
      "Sign multiple documents in a single operation. Upload a batch of PDFs, define signature placement on a reference document, and apply consistent signatures across all files at once.",
    features: [
      "Batch processing of multiple PDFs",
      "Reference-based signature placement",
      "Consistent signature across all documents",
      "Packaged download as ZIP archive",
    ],
    href: "/sign",
    cta: "Start Bulk Signing",
  },
  {
    icon: ShieldCheck,
    title: "Document Verification",
    description:
      "Verify the authenticity and integrity of signed PDF documents. Confirm that signatures are valid, identify the signer, and ensure the document has not been altered after signing.",
    features: [
      "Signature validity confirmation",
      "Signer identity verification",
      "Tamper detection and integrity check",
      "Certificate chain validation",
    ],
    href: "/verify",
    cta: "Verify a Document",
  },
];

const additionalServices = [
  {
    icon: KeyRound,
    title: "Certificate Management",
    description:
      "Issue, renew, and revoke digital certificates for your organization. Manage signing identities centrally with full lifecycle control.",
  },
  {
    icon: ClipboardList,
    title: "Audit Trail & Compliance",
    description:
      "Maintain detailed records of all signing activities. Meet regulatory requirements with comprehensive, tamper-proof audit logs.",
  },
  {
    icon: Code2,
    title: "API Integration",
    description:
      "Integrate document signing directly into your existing systems and workflows through our REST API. Built for developers and IT teams.",
  },
  {
    icon: Clock,
    title: "Trusted Timestamping",
    description:
      "Attach cryptographic timestamps from a trusted authority to prove exactly when a document was signed — critical for legal and regulatory compliance.",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-olive-50/80 via-stone-100 to-lime-50/40" />
        <div className="absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-olive-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 -z-10 size-96 rounded-full bg-lime-200/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700 backdrop-blur-sm">
              <Building2 className="size-3.5" />
              Our Services
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              Secure Document{" "}
              <span className="text-gradient-olive">Services</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-stone-500 sm:text-xl">
              Veriza provides a comprehensive suite of PKI-powered document
              services — from individual signing to enterprise-grade certificate
              management and compliance tooling.
            </p>
          </div>
        </div>
      </section>

      {/* Core Services */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Core Services"
            subtitle="The foundation of our digital signing platform, available to all users."
          />

          <div className="space-y-10">
            {coreServices.map((service, idx) => (
              <GlassCard key={service.title} className="p-0 overflow-hidden">
                <div
                  className={`flex flex-col lg:flex-row ${
                    idx % 2 !== 0 ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  {/* Icon panel */}
                  <div className="flex items-center justify-center bg-olive-50/60 p-10 lg:w-1/3">
                    <div className="flex size-20 items-center justify-center rounded-2xl bg-olive-100 text-olive-600 shadow-sm">
                      <service.icon className="size-9" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-8 lg:p-10">
                    <h3 className="text-2xl font-bold text-stone-900">
                      {service.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-stone-500">
                      {service.description}
                    </p>

                    <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                      {service.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-stone-600"
                        >
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-olive-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      <Link
                        href={service.href}
                        className="inline-flex items-center gap-2 rounded-xl bg-olive-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-olive-700/20 transition-all hover:bg-olive-600 hover:shadow-lg hover:shadow-olive-600/25"
                      >
                        {service.cta}
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Enterprise & Compliance"
            subtitle="Additional capabilities for organizations that require full control, auditability, and integration."
          />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {additionalServices.map((service) => (
              <GlassCard key={service.title} hover className="text-center">
                <div className="mb-5 inline-flex size-13 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                  <service.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {service.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Designed for Institutions"
            subtitle="Veriza is built to meet the needs of government agencies, regulatory bodies, financial institutions, and professional organizations."
          />

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Government & Public Sector",
                description:
                  "Digitize administrative processes, sign official communications, and ensure document authenticity across departments.",
              },
              {
                title: "Financial Institutions",
                description:
                  "Accelerate contract execution, ensure compliance with financial regulations, and maintain secure records of all signed documents.",
              },
              {
                title: "Legal & Professional Services",
                description:
                  "Sign agreements, affidavits, and court filings with certificates that hold legal weight and can be independently verified.",
              },
            ].map((sector) => (
              <GlassCard key={sector.title} hover>
                <h3 className="text-lg font-semibold text-stone-900">
                  {sector.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {sector.description}
                </p>
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
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-base text-olive-100/90">
                Start signing documents today or contact us to discuss
                enterprise deployment for your organization.
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
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                >
                  Contact Us
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
