import { SectionHeading } from "@/components/shared";
import { FaqAccordion } from "@/components/public/faq-accordion";

const faqSections = [
  {
    title: "Signing",
    items: [
      {
        q: "Do I need an account to sign a document?",
        a: "No. You can use our public signing tool at /sign without creating an account. For advanced features like document management and invitations, a free account is required.",
      },
      {
        q: "What file formats are supported?",
        a: "Currently, Veriza supports PDF documents. We are working on adding support for Word and other formats.",
      },
      {
        q: "Can I sign multiple documents at once?",
        a: "Yes. With a paid plan, you can use bulk signing to sign multiple documents in a single session.",
      },
    ],
  },
  {
    title: "Verification",
    items: [
      {
        q: "How do I verify a signed document?",
        a: "Upload the signed PDF to our verification page at /verify. We will check the digital signature, signer identity, and whether the document has been tampered with.",
      },
      {
        q: "Can anyone verify a document?",
        a: "Yes. Verification is free and available to everyone — no account needed.",
      },
    ],
  },
  {
    title: "Legal Validity",
    items: [
      {
        q: "Are Veriza signatures legally binding?",
        a: "Yes. Our PKI-based digital signatures comply with eIDAS (EU), ESIGN Act (US), and UETA, making them legally binding in most jurisdictions.",
      },
      {
        q: "Is a digital signature the same as an electronic signature?",
        a: "Digital signatures are a type of electronic signature that uses cryptographic technology (PKI) to provide stronger security, authenticity, and non-repudiation.",
      },
    ],
  },
  {
    title: "Account & Pricing",
    items: [
      {
        q: "Is there a free plan?",
        a: "Yes. Our free tier allows you to sign up to 5 documents per month with basic features.",
      },
      {
        q: "Can I cancel my subscription anytime?",
        a: "Absolutely. You can upgrade, downgrade, or cancel your plan at any time from your account settings.",
      },
    ],
  },
];

export default function FaqsPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Find answers to common questions about Veriza."
        />
        <div className="space-y-10">
          {faqSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-lg font-semibold text-stone-900">
                {section.title}
              </h3>
              <FaqAccordion items={section.items} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
