import { SectionHeading } from "@/components/shared";
import { PublicVerifyClient } from "@/components/public/public-verify-client";

export default function PublicVerifyPage() {
  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Verify a Document"
          subtitle="Upload a signed PDF to verify its authenticity and integrity."
        />
        <PublicVerifyClient />
      </div>
    </section>
  );
}
