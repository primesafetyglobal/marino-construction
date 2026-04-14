import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/20 bg-white/50 p-6 backdrop-blur-md shadow-sm",
        hover && "transition-all duration-300 hover:shadow-lg hover:bg-white/60 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}
