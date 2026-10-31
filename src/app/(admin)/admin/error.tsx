"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

// Never show error.message: in production it is React's generic Server
// Components text. The digest matches the server log entry.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ref = error.digest ? ` Reference: ${error.digest}.` : "";
  return <ErrorState message={`Something went wrong loading this page.${ref}`} retry={<Button onClick={reset}>Try again</Button>} />;
}
