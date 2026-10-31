import type { Metadata } from "next";
import { Container, PageHero } from "@/components/public/section";
import { PartnerForm } from "@/components/public/vendor-forms";

export const metadata: Metadata = { title: "Partner with us", description: "Suppliers, garages, technicians, contractors and recyclers: work with Marino." };

export default function PartnerPage() {
  return (
    <>
      <PageHero
        eyebrow="Vendors"
        title="Partner with us"
        intro="Suppliers, garages, technicians, contractors and recyclers: register once and we connect you with customers across Rwanda. Approved vendors can become Marino partners."
      />
      <Container className="max-w-3xl py-12">
        <div className="rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft lg:p-10">
          <PartnerForm />
        </div>
      </Container>
    </>
  );
}
