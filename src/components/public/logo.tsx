// Placeholder wordmark until the client supplies the Marino logo (SVG, light and dark).
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2 select-none">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-charcoal">M</span>
      <span className={dark ? "text-white" : "text-ink"}>
        <span className="block text-[15px] leading-none font-extrabold tracking-tight">MARINO</span>
        <span className={`block text-[10px] leading-tight font-medium tracking-wide ${dark ? "text-white/60" : "text-muted"}`}>CONSTRUCTION & SUPPLY</span>
      </span>
    </span>
  );
}
