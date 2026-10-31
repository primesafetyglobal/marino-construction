import Link from "next/link";
import { AlertTriangle, ArrowRight, HardHat, Package, Plus, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/validation/auth";
import { PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDate, formatRwf, todayKigali } from "@/lib/format";
import { getOperationsDashboard } from "@/server/modules/operations/dashboard/dashboard.queries";
import { getPendingEquipmentCount } from "@/server/modules/catalog/equipment/equipment.queries";
import { getPendingVendorCount } from "@/server/modules/parties/vendor/vendor.queries";
import { getOverduePayments, listPayments } from "@/server/modules/parties/payment/payment.queries";
import { getReviewCounters } from "@/server/modules/access/review/review.queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const [ops, pendingEquipment, pendingVendors, overdue, reviews, due] = await Promise.all([
    getOperationsDashboard.page({}),
    getPendingEquipmentCount.page({}),
    getPendingVendorCount.page({}),
    getOverduePayments.page({ limit: 10 }),
    getReviewCounters.page({}),
    listPayments.page({ status: "DUE", limit: 100 }),
  ]);
  const c = ops.counters;
  const today = todayKigali();
  const weekEnd = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const dueThisWeek = due.items.filter((p) => !p.isOverdue && p.dueDate && p.dueDate >= today && p.dueDate <= weekEnd);
  const attention = [
    pendingEquipment > 0 && { href: "/admin/catalog/equipment?status=PENDING", label: `${pendingEquipment} equipment listing${pendingEquipment === 1 ? "" : "s"} awaiting approval`, hazard: true },
    pendingVendors > 0 && { href: "/admin/vendors?status=PENDING", label: `${pendingVendors} vendor${pendingVendors === 1 ? "" : "s"} waiting for review`, hazard: true },
    overdue.length > 0 && { href: "/admin/payments?overdue=1", label: `${overdue.length} overdue installment${overdue.length === 1 ? "" : "s"}: call the client`, hazard: true, danger: true },
    reviews.new > 0 && { href: "/admin/reviews?status=new", label: `${reviews.new} new review${reviews.new === 1 ? "" : "s"} to moderate` },
    c.newApplications > 0 && { href: "/admin/workforce-requests?status=RECRUITING", label: `${c.newApplications} new job application${c.newApplications === 1 ? "" : "s"}` },
  ].filter(Boolean) as { href: string; label: string; hazard?: boolean; danger?: boolean }[];
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Kigali" }).format(new Date()));
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kigali" }).format(new Date());
  return (
    <>
      <PageHeader
        title={`${greet}, ${user.name.split(" ")[0]}`}
        subtitle={<span className="num">{dateLabel}</span>}
        actions={
          <Link href="/admin/requests/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New request
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Equipment requests" hint="New, not yet handled" value={c.newEquipmentRequests} href="/admin/equipment-requests?status=NEW" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Supply orders" hint="New" value={c.newSupplyOrders} href="/admin/supply-orders?status=NEW" icon={<Package className="h-4 w-4" />} />
        <StatCard label="Service requests" hint="New" value={c.newServiceRequests} href="/admin/service-requests?status=NEW" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Workforce requests" hint="New" value={c.newWorkforceRequests} href="/admin/workforce-requests?status=NEW" icon={<HardHat className="h-4 w-4" />} />
        <StatCard label="Active rentals" hint="Machines on site now" value={c.activeRentals} href="/admin/equipment-requests?status=ACTIVE" tone="brand" />
        <StatCard label="Pending approvals" hint={`${pendingVendors} vendors · ${pendingEquipment} equipment`} value={pendingVendors + pendingEquipment} href="/admin/catalog/equipment?status=PENDING" />
        <StatCard label="Overdue installments" hint="Past the due date" value={overdue.length} href="/admin/payments?overdue=1" tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Needs attention" flush>
          {attention.length ? (
            <ul className="divide-y divide-line">
              {attention.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className={cn("relative flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-canvas", a.hazard && "hazard-edge")}>
                    <AlertTriangle className={cn("h-4 w-4 shrink-0", a.danger ? "text-danger" : "text-warning")} />
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="All clear. Nothing waiting on you." className="m-4 border-0 py-8" />
          )}
        </Panel>
        <Panel title="Latest requests" flush actions={<Link href="/admin/equipment-requests" className="text-xs font-medium text-muted hover:text-ink">All requests</Link>}>
          {ops.latest.length ? <RequestRows rows={ops.latest} /> : <EmptyState title="No requests yet" className="m-4 border-0 py-8" />}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Assigned to me" flush>
          {ops.myOpen.length ? <RequestRows rows={ops.myOpen} /> : <EmptyState title="Nothing assigned to you" className="m-4 border-0 py-8" />}
        </Panel>
        <Panel title="Payments due this week" flush actions={<Link href="/admin/payments?status=DUE" className="text-xs font-medium text-muted hover:text-ink">All payments</Link>}>
          {overdue.length + dueThisWeek.length ? (
            <ul className="divide-y divide-line">
              {[...overdue.map((p) => ({ ...p, late: true })), ...dueThisWeek.map((p) => ({ ...p, late: false }))].map((p) => (
                <li key={p.id} className={cn("relative flex flex-wrap items-center gap-3 px-5 py-3 text-sm", p.late && "hazard-edge")}>
                  <span className="num w-32 font-semibold">{formatRwf(p.amount)}</span>
                  {p.request && (
                    <Link href={p.request.href} className="num text-xs hover:underline">
                      {p.request.code}
                    </Link>
                  )}
                  <span className="min-w-0 flex-1 truncate text-muted">{p.request?.clientName}</span>
                  <span className={cn("num text-xs", p.late ? "font-semibold text-danger" : "text-muted")}>
                    {p.late ? "Overdue · " : "Due "}
                    {formatDate(p.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No installments due this week" className="m-4 border-0 py-8" />
          )}
        </Panel>
      </div>
    </>
  );
}

function RequestRows({ rows }: { rows: { id: string; code: string; href: string; title: string; clientName: string; status: string; createdAt: Date }[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={r.href} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-canvas">
            <span className="num w-24 shrink-0 text-xs font-semibold">{r.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.title}</span>
              <span className="block truncate text-xs text-muted">
                {r.clientName} · {formatDate(r.createdAt)}
              </span>
            </span>
            <StatusPill status={r.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
