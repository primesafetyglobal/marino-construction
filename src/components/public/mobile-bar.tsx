"use client";

import { MessageCircle } from "lucide-react";
import { whatsappHref } from "@/config/site";
import { buttonClass } from "@/components/ui/button";
import { RequestButton } from "./request-sheet";

// Sticky bottom bar on mobile: Request + WhatsApp (Design §3.5).
export function MobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex gap-2">
        <RequestButton className="flex-1" size="lg">
          Request a quote
        </RequestButton>
        <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "lg")} aria-label="WhatsApp">
          <MessageCircle className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
