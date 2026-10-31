import { ActionButton } from "@/components/admin/actions";
import { EditUserButton } from "@/components/admin/user-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPhone, humanize } from "@/lib/format";
import { deleteUser, resendInvite, sendPasswordReset, setUserActive } from "@/server/modules/access/user/user.actions";
import { getUser } from "@/server/modules/access/user/user.queries";
import { getUserActivity } from "@/server/modules/access/auth-event/auth-event.queries";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [u, activity] = await Promise.all([getUser.page({ id }), getUserActivity.page({ userId: id })]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/users", label: "Users" }}
        title={
          <span className="flex items-center gap-3">
            {u.name} {u.invitePending ? <Badge tone="warning">Invite pending</Badge> : u.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
          </span>
        }
        subtitle={`${humanize(u.role)} · ${u.email}`}
        actions={
          <>
            {u.can.edit && <EditUserButton user={u} roles={u.can.roles} />}
            {u.can.resendInvite && (
              <ActionButton action={resendInvite.bind(null, { id: u.id })} success="Invite sent again.">
                Resend invite
              </ActionButton>
            )}
            {u.can.sendReset && (
              <ActionButton action={sendPasswordReset.bind(null, { id: u.id })} success="Reset link sent.">
                Send password reset
              </ActionButton>
            )}
            {u.can.deactivate &&
              (u.isActive ? (
                <ActionButton variant="danger" confirm="Deactivate this user? They are signed out on their next click." action={setUserActive.bind(null, { id: u.id, isActive: false })} success="User deactivated.">
                  Deactivate
                </ActionButton>
              ) : (
                <ActionButton action={setUserActive.bind(null, { id: u.id, isActive: true })} success="User reactivated.">
                  Reactivate
                </ActionButton>
              ))}
            {u.can.delete && (
              <ActionButton variant="danger" confirm="Delete this user? Users who handle requests must be deactivated instead." action={deleteUser.bind(null, { id: u.id })} redirectTo="/admin/users" success="User deleted.">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="Account">
          <DefList
            rows={[
              ["Email", u.email],
              ["Phone", formatPhone(u.phone)],
              ["Role", humanize(u.role)],
              ["Last login", formatDateTime(u.lastLoginAt)],
              ["Created", formatDateTime(u.createdAt)],
            ]}
          />
        </Panel>
        <Panel title="Recent activity">
          {activity.length ? (
            <ul className="divide-y divide-line/50 text-sm">
              {activity.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Badge tone={e.type === "LOGIN_FAILED" ? "danger" : e.type === "LOGIN_SUCCESS" ? "success" : "neutral"}>{humanize(e.type)}</Badge>
                  <span className="text-muted">{formatDateTime(e.createdAt)}</span>
                  {e.ip && <span className="font-mono text-xs text-muted">{e.ip}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No activity yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
