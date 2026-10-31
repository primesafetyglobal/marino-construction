import { Container } from "@/components/public/section";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="bg-sand py-16">
        <Container>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-12 w-2/3" />
          <Skeleton className="mt-4 h-5 w-1/2" />
        </Container>
      </div>
      <Container className="py-14">
        <CardGridSkeleton count={8} />
      </Container>
    </>
  );
}
