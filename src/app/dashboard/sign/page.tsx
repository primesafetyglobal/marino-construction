import { SectionHeading } from "@/components/shared";
import { AuthSignClient } from "@/components/dashboard/auth-sign-client";

export default function DashboardSignPage() {
  return (
    <>
      <SectionHeading
        title="Sign a Document"
        subtitle="Upload, sign, save, and invite others to sign."
        centered={false}
      />
      <AuthSignClient />
    </>
  );
}
