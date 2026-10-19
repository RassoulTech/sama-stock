import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#0B6E4F" />
      <path
        d="M16 7.5 24 11.75v8.5L16 24.5 8 20.25v-8.5Z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M8 11.75 16 16l8-4.25M16 16v8.5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="24.5" cy="7.5" r="3.25" fill="#F59E0B" stroke="#0B6E4F" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-7" />
      <span
        className={cn(
          "text-[1.0625rem] font-semibold tracking-[-0.03em]",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        Sama <span className={inverted ? "text-saffron" : "text-primary"}>Stock</span>
      </span>
    </span>
  );
}
