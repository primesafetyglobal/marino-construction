import { ChangeEmailForm, ChangePasswordForm } from "@/components/admin/user-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { formatDateTime, formatPhone, humanize } from "@/lib/format";
import { getCurrentUser } from "@/server/modules/access/user/user.queries";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await getCurrentUser.page({});
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Profile">
          <DefList
            rows={[
              ["Name", me.name],
              ["Email", me.email],
              ["Phone", formatPhone(me.phone)],
              ["Role", humanize(me.role)],
              ["Last login", formatDateTime(me.lastLoginAt)],
            ]}
          />
        </Panel>
        <Panel title="Change password">
          <ChangePasswordForm email={me.email} />
        </Panel>
        <Panel title="Change email">
          <ChangeEmailForm />
        </Panel>
      </div>
    </>
  );
}
