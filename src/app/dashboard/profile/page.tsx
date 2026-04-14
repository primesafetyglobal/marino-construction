import { SectionHeading } from "@/components/shared";
import { ProfileClient } from "@/components/dashboard/profile-client";

export default function ProfilePage() {
  return (
    <>
      <SectionHeading
        title="Profile"
        subtitle="Manage your personal information and settings."
        centered={false}
      />
      <ProfileClient />
    </>
  );
}
