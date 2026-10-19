import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Champ numérique avec suffixe (FCFA, unité…). */
export function SuffixInput({
  suffix,
  className,
  ...props
}: React.ComponentProps<"input"> & { suffix: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        {...props}
        className={cn(
          "num h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 pr-16 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          className,
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-semibold text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
