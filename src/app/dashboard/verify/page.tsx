import { SectionHeading } from "@/components/shared";
import { AuthVerifyClient } from "@/components/dashboard/auth-verify-client";

export default function DashboardVerifyPage() {
  return (
    <>
      <SectionHeading
        title="Verify a Document"
        subtitle="Upload a signed PDF to verify and save the result."
        centered={false}
      />
      <AuthVerifyClient />
    </>
  );
}
