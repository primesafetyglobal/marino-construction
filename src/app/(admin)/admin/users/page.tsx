import { UsersList } from "@/components/admin/lists";
import { InviteUserButton } from "@/components/admin/user-forms";
import { PageHeader } from "@/components/admin/ui";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { listUsers } from "@/server/modules/access/user/user.queries";
import { assignableRolesFor } from "@/server/modules/access/access.fields";

export const metadata = { title: "Users" };

// Admin+ only: Staff are sent to the "no access" page by the query (user:read).
export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "role"]);
  const [page, user] = await Promise.all([listUsers.page(params), requireUser()]);
  return (
    <>
      <PageHeader title="Users" subtitle="Staff who can sign in to this dashboard." actions={hasPermission(user, "user:invite") ? <InviteUserButton roles={assignableRolesFor(user.role)} /> : null} />
      <UsersList initial={jsonify(page)} params={params} />
    </>
  );
}
