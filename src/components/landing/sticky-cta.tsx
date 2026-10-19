"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Barre d'inscription qui reste visible sur mobile une fois le haut de page dépassé. */
export function StickyCta({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 700;
      setVisible(window.scrollY > 640 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link
        href={href}
        tabIndex={visible ? 0 : -1}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-saffron text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
      >
        Essai gratuit 14 jours <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
