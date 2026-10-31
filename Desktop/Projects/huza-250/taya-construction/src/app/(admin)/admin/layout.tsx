import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell, type SidebarCounters } from "@/components/admin/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { AUTH_PATHS, getUser, hasPermission } from "@/server/validation/auth";
import { getOperationsCounters } from "@/server/modules/operations/dashboard/dashboard.queries";
import { getPendingEquipmentCount } from "@/server/modules/catalog/equipment/equipment.queries";
import { getPendingVendorCount } from "@/server/modules/parties/vendor/vendor.queries";
import { getOverdueCount } from "@/server/modules/parties/payment/payment.queries";
import { getReviewCounters } from "@/server/modules/access/review/review.queries";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Marino admin" }, robots: { index: false } };

// Staff dashboard layout. Signed-out visitors go to the login page; every
// page's query checks access again (createQuery).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect(`${AUTH_PATHS.signIn}?callbackUrl=/admin`);
  const quiet = <T,>(p: Promise<T>) => p.catch(() => undefined);
  const [ops, pendingEquipment, pendingVendors, overdue, reviews] = await Promise.all([
    quiet(getOperationsCounters({})),
    quiet(getPendingEquipmentCount({})),
    quiet(getPendingVendorCount({})),
    quiet(getOverdueCount({})),
    quiet(getReviewCounters({})),
  ]);
  const counters: SidebarCounters = { ...ops, pendingEquipment, pendingVendors, overdue, newReviews: reviews?.new };
  return (
    <ToastProvider>
      <AdminShell user={{ name: user.name, email: user.email, role: user.role }} counters={counters} canUsers={hasPermission(user, "user:read")} canFiles={hasPermission(user, "file:read")}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
