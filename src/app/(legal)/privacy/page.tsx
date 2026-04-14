export default function PrivacyPage() {
  return (
    <article className="prose prose-stone prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-stone-900">Privacy Policy</h1>
      <p className="text-stone-500">Last updated: April 12, 2026</p>

      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly, including your name, email
        address, and documents you upload for signing. We also collect usage data
        such as IP addresses, browser type, and access times.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>
        We use your information to provide and improve our signing services,
        communicate with you, and ensure the security of our platform.
      </p>

      <h2>3. Document Handling</h2>
      <p>
        Documents uploaded for public signing (without an account) are processed
        in memory and not permanently stored. Authenticated users&apos; documents
        are encrypted at rest and stored securely.
      </p>

      <h2>4. Data Security</h2>
      <p>
        We implement industry-standard security measures including encryption in
        transit and at rest, access controls, and regular security audits.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You have the right to access, correct, or delete your personal data. You
        may also request a copy of your data or withdraw consent at any time.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us at{" "}
        <a href="mailto:privacy@veriza.io" className="text-olive-600 hover:text-olive-700">
          privacy@veriza.io
        </a>
        .
      </p>
    </article>
  );
}
