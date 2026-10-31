import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Lock className="h-10 w-10 text-muted" />
      <h1 className="text-xl font-bold">You don&apos;t have access to this page</h1>
      <p className="text-sm text-muted">Ask an administrator if you need it.</p>
      <Link href="/admin" className={buttonClass("dark")}>
        Back to the dashboard
      </Link>
    </div>
  );
}
