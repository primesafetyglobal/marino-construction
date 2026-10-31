// USER SELECT: never includes the password (ACC-R8). The admin select reads
// it only to compute invitePending, and the service removes it.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const userAdminSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  password: true, // only to compute invitePending; removed by the service
} satisfies Prisma.UserSelect;

export const userPickerSelect = { id: true, name: true } satisfies Prisma.UserSelect;
export const userRefSelect = { id: true, name: true, email: true, role: true, isActive: true } satisfies Prisma.UserSelect;
export const currentUserSelect = { id: true, name: true, email: true, phone: true, role: true, lastLoginAt: true } satisfies Prisma.UserSelect;

type Row<S extends Prisma.UserSelect> = Prisma.UserGetPayload<{ select: S }>;
export type UserItem = Omit<Row<typeof userAdminSelect>, "password"> & { invitePending: boolean };
export type UserDetail = UserItem & { can: { edit: boolean; deactivate: boolean; delete: boolean; resendInvite: boolean; sendReset: boolean; roles: string[] } };
export type UserPickerItem = Row<typeof userPickerSelect>;
export type UserRef = Row<typeof userRefSelect>;
export type CurrentUser = Row<typeof currentUserSelect>;
export type UserList = ({ view: "admin" } & Page<UserItem>) | ({ view: "picker" } & Page<UserPickerItem>);
