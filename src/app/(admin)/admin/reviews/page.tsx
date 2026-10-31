import { ReviewsList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { listReviews } from "@/server/modules/access/review/review.queries";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdminPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["status", "rating"]);
  const [page, user] = await Promise.all([listReviews.page(params), requireUser()]);
  return (
    <>
      <PageHeader title="Reviews and feedback" subtitle="New reviews are never public until you make them public. Contact details are never shown on the site." />
      <ReviewsList initial={jsonify(page)} params={params} canDelete={hasPermission(user, "review:delete")} />
    </>
  );
}
