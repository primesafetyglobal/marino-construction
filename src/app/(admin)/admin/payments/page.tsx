import { PaymentsList } from "@/components/admin/lists";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { formatRwf } from "@/lib/format";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { getPaymentSummary, listPayments } from "@/server/modules/parties/payment/payment.queries";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["status", "overdue"]);
  const [page, totals, user] = await Promise.all([listPayments.page(params), getPaymentSummary.page({}), requireUser()]);
  return (
    <>
      <PageHeader title="Payments and installments" subtitle="Record payments and plans on each request's page; mark installments paid here or there." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={formatRwf(totals.paid)} />
        <StatCard label="Outstanding (due)" value={formatRwf(totals.due)} />
        <StatCard label="Overdue" value={formatRwf(totals.overdue)} href="/admin/payments?overdue=1" tone="danger" />
      </div>
      <PaymentsList initial={jsonify(page)} params={params} canRecord={hasPermission(user, "payment:record")} />
    </>
  );
}
