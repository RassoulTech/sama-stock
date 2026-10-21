"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Deux façons d'avoir Sama Stock : l'acheter une fois (mis en avant) ou s'abonner chaque mois. */
export function PricingTabs({ licence, subscription }: { licence: React.ReactNode; subscription: React.ReactNode }) {
  const [tab, setTab] = useState<"licence" | "abonnement">("licence");
  const tabs = [
    { id: "licence", label: "Acheter une fois", hint: "Recommandé" },
    { id: "abonnement", label: "Abonnement mensuel", hint: "Sans engagement" },
  ] as const;

  return (
    <div>
      <div role="tablist" aria-label="Façon de payer" className="reveal mx-auto mt-10 flex w-fit rounded-2xl border bg-card p-1.5 shadow-[0_1px_2px_rgb(11_19_16/0.04)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-col items-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors sm:px-6",
              tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className={cn("text-[11px] font-medium", tab === t.id ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{t.hint}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-licence" aria-labelledby="tab-licence" hidden={tab !== "licence"}>
        {licence}
      </div>
      <div role="tabpanel" id="panel-abonnement" aria-labelledby="tab-abonnement" hidden={tab !== "abonnement"}>
        {subscription}
      </div>
    </div>
  );
}
