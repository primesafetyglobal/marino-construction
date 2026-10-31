"use client";

// "Load more" for public lists: the first page comes from the Server
// Component; later pages come from the GET route with the same URL params.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Grid } from "./section";
import { EquipmentCard, JobCard, ProductCard, ReviewCard, ServiceCard, TrainingCard } from "./cards";

type Kind = "equipment" | "product" | "service" | "training" | "job" | "review";
const ENDPOINT: Record<Kind, `/api/${string}`> = {
  equipment: "/api/v1/catalog/equipment",
  product: "/api/v1/catalog/product",
  service: "/api/v1/catalog/service",
  training: "/api/v1/catalog/training",
  job: "/api/v1/operations/job",
  review: "/api/v1/access/review/public",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = any;

export function LoadMoreGrid({ kind, initial, nextCursor, params, cols = 4 }: { kind: Kind; initial: Item[]; nextCursor: string | null; params?: Record<string, string | undefined>; cols?: 2 | 3 | 4 }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    const res = await apiGet<{ items: Item[]; nextCursor: string | null }>(ENDPOINT[kind], { ...params, cursor });
    setLoading(false);
    if (!res.ok) return setError(res.error.message);
    setItems((prev) => [...prev, ...res.data.items]);
    setCursor(res.data.nextCursor);
  }

  const render = (it: Item) => {
    switch (kind) {
      case "equipment":
        return <EquipmentCard key={it.id} item={it} />;
      case "product":
        return <ProductCard key={it.id} item={it} />;
      case "service":
        return <ServiceCard key={it.id} item={it} />;
      case "training":
        return <TrainingCard key={it.id} item={it} />;
      case "job":
        return <JobCard key={it.id} job={it} />;
      case "review":
        return <ReviewCard key={it.id} review={it} />;
    }
  };

  return (
    <div className="space-y-6">
      {kind === "job" ? <div className="space-y-3">{items.map(render)}</div> : <Grid cols={cols}>{items.map(render)}</Grid>}
      {error && (
        <p className="text-center text-sm text-danger">
          {error}{" "}
          <button className="font-semibold underline" onClick={more}>
            Try again
          </button>
        </p>
      )}
      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={more} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
