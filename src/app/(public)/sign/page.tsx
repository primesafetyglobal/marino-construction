import { SectionHeading } from "@/components/shared";
import { PublicSignClient } from "@/components/public/public-sign-client";

export default function PublicSignPage() {
  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Sign a Document"
          subtitle="Upload your PDF, place your signature, and download — no account required."
        />
        <PublicSignClient />
      </div>
    </section>
  );
}
