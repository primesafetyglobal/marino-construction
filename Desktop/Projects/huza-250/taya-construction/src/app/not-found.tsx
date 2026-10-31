import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-3xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have moved, or it is not available any more.</p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-3")}>
        Go to the home page
      </Link>
    </div>
  );
}
