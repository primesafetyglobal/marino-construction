"use client";

import { Container } from "@/components/public/section";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

// Never show error.message: in production it is React's generic Server
// Components text, and in development it can leak internals.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-20">
      <ErrorState message={friendlyMessage(error)} retry={<Button onClick={reset}>Try again</Button>} />
    </Container>
  );
}

function friendlyMessage(error: Error & { digest?: string }) {
  const ref = error.digest ? ` (reference ${error.digest})` : "";
  return `We couldn't load this page right now. Please try again in a moment${ref}.`;
}
