import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  centered = true,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(centered && "text-center", "mb-12", className)}>
      <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base text-stone-500 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
