import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-full border bg-card pr-3.5 pl-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:mb-2 lg:h-auto lg:border-0 lg:bg-transparent lg:p-0"
          >
            <ArrowLeft className="size-4" /> Retour
          </Link>
        )}
        <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.025em] sm:text-2xl">{title}</h1>
        {description && <p className="text-[0.875rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
