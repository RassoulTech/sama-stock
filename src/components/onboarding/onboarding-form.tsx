"use client";

import { Hammer, Loader2, Shapes, ShoppingBag, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Activity } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { createBusiness } from "@/server/actions/business";

const ACTIVITY_CARDS: { id: Activity; label: string; hint: string; icon: typeof Store }[] = [
  { id: "ecommerce", label: "E-commerce", hint: "WhatsApp, Instagram, TikTok…", icon: ShoppingBag },
  { id: "boutique", label: "Boutique", hint: "Mode, supérette, cosmétiques…", icon: Store },
  { id: "quincaillerie", label: "Quincaillerie", hint: "Ciment, fer, plomberie…", icon: Hammer },
  { id: "autre", label: "Autre", hint: "Un peu de tout", icon: Shapes },
];

export const SENEGAL_CITIES = [
  "Dakar",
  "Pikine",
  "Guédiawaye",
  "Rufisque",
  "Keur Massar",
  "Thiès",
  "Mbour",
  "Saint-Louis",
  "Kaolack",
  "Touba",
  "Ziguinchor",
  "Diourbel",
  "Louga",
  "Tambacounda",
  "Kolda",
  "Fatick",
  "Kaffrine",
  "Kédougou",
  "Matam",
  "Sédhiou",
];

export function OnboardingForm({ userName }: { userName: string }) {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!activity) {
      setError("Choisissez votre activité.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBusiness({
        name: String(form.get("name") ?? ""),
        activity,
        phone: String(form.get("phone") ?? ""),
        city: String(form.get("city") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/tableau-de-bord");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-primary">Bienvenue {userName.split(" ")[0]} !</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Parlez-nous de votre commerce</h1>
        <p className="text-sm text-muted-foreground">
          Deux minutes, et Sama Stock s&apos;adapte à votre façon de travailler.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nom du commerce</Label>
        <Input id="name" name="name" required minLength={2} placeholder="Ex. Boutique Awa Mode" />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Votre activité principale</legend>
        <div className="grid grid-cols-2 gap-3">
          {ACTIVITY_CARDS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivity(id)}
              aria-pressed={activity === id}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50",
                activity === id && "border-primary bg-accent ring-2 ring-primary/20",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground",
                  activity === id && "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="font-semibold">{label}</span>
              <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone du commerce</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="77 123 45 67" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" list="cities" placeholder="Dakar" />
          <datalist id="cities">
            {SENEGAL_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Commencer mon essai gratuit
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        14 jours offerts. Aucun paiement demandé maintenant.
      </p>
    </form>
  );
}
