"use client";

import dynamic from "next/dynamic";
import type { ISignatureZone } from "@/types";

const SigningViewer = dynamic(
  () => import("./SigningViewer").then((mod) => ({ default: mod.SigningViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-stone-200/60 bg-white/50">
        <div className="flex flex-col items-center gap-3">
          <div className="size-7 animate-spin rounded-full border-[3px] border-olive-200 border-t-olive-600" />
          <p className="text-xs text-stone-500">Loading PDF viewer…</p>
        </div>
      </div>
    ),
  }
);

interface SigningViewerDynamicProps {
  file: File;
  zones: ISignatureZone[];
  selectedZoneId: string | null;
  maxZones?: number;
  onZonesChange: (zones: ISignatureZone[]) => void;
  onSelectZone: (id: string | null) => void;
  onRemoveFile: () => void;
}

export function SigningViewerDynamic(props: SigningViewerDynamicProps) {
  return <SigningViewer {...props} />;
}
