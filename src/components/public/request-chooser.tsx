"use client";

import { useEffect } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { DIVISIONS, type DivisionEnum } from "@/config/divisions";
import { SITE } from "@/config/site";
import { DivisionIcon } from "@/components/ui/icons";
import { useRequestSheet, type RequestTarget } from "./request-sheet";

function targetOf(d: DivisionEnum): RequestTarget | null {
  if (d === "EQUIPMENT") return { kind: "equipment" };
  if (d === "MATERIALS") return { kind: "supply" };
  if (d === "WORKFORCE") return { kind: "workforce" };
  if (d === "TRAINING") return null;
  return { kind: "service", division: d, installments: d === "PAINT_RWANDA" };
}

export function RequestChooser({ preselected }: { preselected?: DivisionEnum }) {
  const { open } = useRequestSheet();
  useEffect(() => {
    if (preselected && targetOf(preselected)) open(targetOf(preselected));
  }, [preselected, open]);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {DIVISIONS.map((d) => {
        const t = targetOf(d.enum);
        const inner = (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint">
              <DivisionIcon icon={d.icon} className="h-5 w-5" />
            </span>
            <span className="flex-1 text-left">
              <span className="block font-semibold">{d.name}</span>
              <span className="block text-xs text-muted">{d.tagline}</span>
            </span>
          </>
        );
        return (
          <li key={d.enum}>
            {t ? (
              <button type="button" onClick={() => open(t)} className="flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-white p-4 shadow-soft transition hover:shadow-lift">
                {inner}
                <ArrowRight className="h-4 w-4 text-muted" />
              </button>
            ) : (
              <a href={SITE.links.primeSafetyGlobal} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-white p-4 shadow-soft transition hover:shadow-lift">
                {inner}
                <ExternalLink className="h-4 w-4 text-muted" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
