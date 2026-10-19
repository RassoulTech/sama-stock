"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Inscription en un geste : l'email saisi est repris sur la page d'inscription. */
export function EmailSignup({
  cta = "Commencer gratuitement",
  className,
  tone = "light",
}: {
  cta?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <form
      className={cn("flex w-full max-w-md flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const value = email.trim();
        router.push(value ? `/inscription?email=${encodeURIComponent(value)}` : "/inscription");
      }}
    >
      <label htmlFor={`signup-${tone}`} className="sr-only">
        Votre adresse email
      </label>
      <input
        id={`signup-${tone}`}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Votre adresse email"
        className={cn(
          "h-12 w-full min-w-0 shrink-0 rounded-lg border px-4 sm:w-auto sm:flex-1 text-base outline-none transition-shadow focus-visible:ring-3 sm:text-[0.9375rem]",
          tone === "light"
            ? "border-input bg-card shadow-[0_1px_2px_rgb(11_19_16/0.06)] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
            : "border-white/15 bg-white/10 text-white placeholder:text-white/55 focus-visible:border-saffron focus-visible:ring-saffron/30",
        )}
      />
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-saffron px-5 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(120_60_0/0.25),0_8px_24px_-8px_rgb(245_158_11/0.55)] transition-colors hover:bg-[#ec9708] focus-visible:ring-3 focus-visible:ring-saffron/40 focus-visible:outline-none"
      >
        {cta}
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
