"use client";

import { Container } from "@/components/public/section";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-20">
      <ErrorState message={error.message || "Something went wrong."} retry={<Button onClick={reset}>Try again</Button>} />
    </Container>
  );
}
