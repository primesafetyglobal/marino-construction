import { ActionButton } from "@/components/admin/actions";
import { TrainingDialogButton } from "@/components/admin/catalog-forms";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { MediaCard } from "@/components/ui/media-card";
import { EmptyState } from "@/components/ui/states";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { deleteTraining } from "@/server/modules/catalog/training/training.actions";
import { listTrainingsAdmin } from "@/server/modules/catalog/training/training.queries";

export const metadata = { title: "Trainings" };

export default async function TrainingsAdminPage() {
  const [page, user] = await Promise.all([listTrainingsAdmin.page({ limit: 100 }), requireUser()]);
  const uploads = (await hasActiveStorage("PUBLIC"));
  return (
    <>
      <PageHeader title="Trainings" subtitle="Cards that link to Prime Safety Global." actions={hasPermission(user, "training:create") ? <TrainingDialogButton label="New training" uploadsEnabled={uploads} /> : null} />
      {page.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {page.items.map((t, i) => (
            <MediaCard
              key={t.id}
              href={t.externalUrl}
              image={t.image}
              title={t.title}
              seed={i}
              icon="GraduationCap"
              meta={t.type === "HSE" ? "HSE training · Prime Safety Global" : "Construction training · Prime Safety Global"}
              status={t.isPublished ? <Badge tone="success" dot className="bg-white/95">Published</Badge> : <Badge dot className="bg-white/95">Hidden</Badge>}
              featured={t.isFeatured}
              footer={
                <div className="flex flex-wrap gap-2">
                  {hasPermission(user, "training:update") && <TrainingDialogButton label="Edit" item={t} uploadsEnabled={uploads} />}
                  {hasPermission(user, "training:delete") && (
                    <ActionButton variant="danger" confirm="Delete this training?" action={deleteTraining.bind(null, { id: t.id })} success="Deleted.">
                      Delete
                    </ActionButton>
                  )}
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No trainings yet" action={hasPermission(user, "training:create") ? <TrainingDialogButton label="New training" uploadsEnabled={uploads} /> : undefined} />
      )}
    </>
  );
}
