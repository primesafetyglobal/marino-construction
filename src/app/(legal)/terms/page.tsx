export default function TermsPage() {
  return (
    <article className="prose prose-stone prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-stone-900">Terms of Service</h1>
      <p className="text-stone-500">Last updated: April 12, 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Veriza, you agree to be bound by these Terms of
        Service. If you do not agree, please do not use our platform.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Veriza provides PKI-powered digital signing and verification services for
        PDF documents. We offer both free public signing and premium authenticated
        features.
      </p>

      <h2>3. User Responsibilities</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activities under your account. You must not use our
        services for illegal purposes.
      </p>

      <h2>4. Digital Signatures</h2>
      <p>
        Our digital signatures comply with applicable electronic signature laws.
        However, the legal validity of a digital signature may vary by
        jurisdiction. You are responsible for ensuring compliance with local laws.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        Veriza is provided &quot;as is&quot; without warranties of any kind. We are not
        liable for any damages arising from the use of our services.
      </p>

      <h2>6. Changes to Terms</h2>
      <p>
        We may update these terms from time to time. Continued use of the platform
        after changes constitutes acceptance of the new terms.
      </p>

      <h2>7. Contact</h2>
      <p>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:legal@veriza.io" className="text-olive-600 hover:text-olive-700">
          legal@veriza.io
        </a>
        .
      </p>
    </article>
  );
}
