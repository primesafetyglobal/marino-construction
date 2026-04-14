import { InvitationsClient } from "@/components/dashboard/invitations-client";
import { SectionHeading } from "@/components/shared";

export default function InvitationsPage() {
  return (
    <>
      <SectionHeading
        title="Invitations"
        subtitle="Documents waiting for your signature."
        centered={false}
      />
      <InvitationsClient />
    </>
  );
}
