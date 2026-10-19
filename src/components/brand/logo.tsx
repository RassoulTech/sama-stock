import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="#0B6E4F" />
      <path
        d="M21.6 11.4c-.9-1.7-2.9-2.8-5.5-2.8-3.2 0-5.3 1.6-5.3 3.9 0 5.4 11 2.5 11 8 0 2.5-2.3 4.4-5.8 4.4-2.7 0-4.8-1.1-5.8-2.9"
        fill="none"
        stroke="#fff"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="24.6" cy="7.6" r="2.4" fill="#F59E0B" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7", inverted && "rounded-[9px] ring-1 ring-white/30")} />
      <span
        className={cn(
          "text-[1.0625rem] font-bold tracking-[-0.035em] whitespace-nowrap",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        Sama <span className={inverted ? "text-saffron" : "text-primary"}>Stock</span>
      </span>
    </span>
  );
}
