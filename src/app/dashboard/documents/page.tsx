import { DocumentsClient } from "@/components/dashboard/documents-client";
import { SectionHeading } from "@/components/shared";

export default function DocumentsPage() {
  return (
    <>
      <SectionHeading
        title="Documents"
        subtitle="Manage all your signed and pending documents."
        centered={false}
      />
      <DocumentsClient />
    </>
  );
}
