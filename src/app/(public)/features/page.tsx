import {
  FileSignature,
  Users,
  ShieldCheck,
  ScrollText,
  Lock,
  Eye,
  Layers,
  Stamp,
} from "lucide-react";
import { GlassCard, SectionHeading } from "@/components/shared";

const features = [
  {
    icon: FileSignature,
    title: "Visual PDF Signing",
    description:
      "View your PDF inline, place your signature exactly where you want it, and see a real-time preview before finalizing.",
  },
  {
    icon: Layers,
    title: "Bulk Signing",
    description:
      "Sign multiple documents in one session. Upload a batch, apply your signature, and download all at once.",
  },
  {
    icon: Users,
    title: "Multi-Signer Support",
    description:
      "Invite multiple signers to a single document. Track who has signed and who is pending.",
  },
  {
    icon: ShieldCheck,
    title: "Verification & Audit",
    description:
      "Verify any signed document instantly. Full audit trail with timestamps, signer identity, and certificate details.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description:
      "PKI-based digital signatures with SHA-256 encryption. Your documents are tamper-proof and legally binding.",
  },
  {
    icon: Eye,
    title: "Real-Time Preview",
    description:
      "See exactly how your signed document will look before you finalize. Zoom, navigate, and reposition.",
  },
  {
    icon: ScrollText,
    title: "Document Management",
    description:
      "Organize, search, and manage all your signed documents in one place with status tracking.",
  },
  {
    icon: Stamp,
    title: "Custom Signatures",
    description:
      "Draw your signature, type it in a stylized font, or upload an image. Choose what works best for you.",
  },
];

export default function FeaturesPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Powerful Features"
          subtitle="Everything you need to sign, verify, and manage documents securely."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
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
  );
}
