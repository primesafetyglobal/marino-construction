"use client";

import { FaqAccordion } from "./faq-accordion";

const securityFaqs = [
  {
    q: "How does PKI signing work?",
    a: "PKI (Public Key Infrastructure) uses a pair of cryptographic keys — a private key to create the signature and a public key to verify it. This ensures that only the signer could have created the signature, and any tampering is detectable.",
  },
  {
    q: "Is my document stored on your servers?",
    a: "For public signing (no account), documents are processed in memory and not permanently stored. For authenticated users, documents are encrypted at rest with AES-256 and stored securely.",
  },
  {
    q: "What happens if someone modifies a signed document?",
    a: "Any modification to a signed document invalidates the digital signature. Our verification tool will immediately detect and flag any tampering.",
  },
  {
    q: "What compliance standards do you meet?",
    a: "Veriza signatures comply with eIDAS (EU), the ESIGN Act (US), and UETA. We use X.509 certificates and SHA-256 hashing as per industry standards.",
  },
];

export function SecurityFaq() {
  return <FaqAccordion items={securityFaqs} />;
}
