"use client";

import { ArrowLeft, Delete, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/format";
import { PIN_LENGTH } from "@/lib/domain/staff-pin";
import { cn } from "@/lib/utils";

export interface StaffEntry {
  id: string;
  name: string;
  roleLabel: string;
}

/**
 * Appareil de la boutique : l'employé touche son nom puis tape son code PIN sur un grand clavier.
 * Le code est vérifié par le serveur (5 codes faux = 15 minutes de blocage).
 */
export function StaffLogin({ slug, staff, onUseEmail }: { slug: string; staff: StaffEntry[]; onUseEmail?: () => void }) {
  const [who, setWho] = useState<StaffEntry | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    if (!who) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/pin/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: who.id, pin: value }),
      });
      if (res.ok) {
        // Navigation complète voulue : /entrer est une route (pas une page) qui lit la nouvelle session puis redirige
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/b/${slug}/entrer`);
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Code incorrect.");
    } catch {
      setError("Pas d'internet : la connexion par code a besoin du réseau pour l'instant.");
    }
    setPin("");
    setPending(false);
  }

  function press(digit: string) {
    if (pending || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  if (!who) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">Qui êtes-vous ?</h1>
          <p className="text-sm text-muted-foreground">Touchez votre nom, puis tapez votre code.</p>
        </div>
        {staff.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Aucun employé n&apos;a encore de code. Le propriétaire les ajoute dans Équipe.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {staff.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setWho(s)}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent/50 active:translate-y-px"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
                    {initials(s.name)}
                  </span>
                  <span className="w-full truncate text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.roleLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {onUseEmail && (
          <button type="button" onClick={onUseEmail} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Mail className="size-4" /> Propriétaire ou gérant : se connecter avec l&apos;e-mail
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          setWho(null);
          setPin("");
          setError(null);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Changer de nom
      </button>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">{initials(who.name)}</span>
        <p className="text-lg font-semibold">{who.name}</p>
        <p className="text-sm text-muted-foreground">Tapez votre code à {PIN_LENGTH} chiffres</p>
      </div>

      <div className={cn("flex justify-center gap-3", error && "animate-[shake_0.3s]")} aria-live="polite" aria-label={`${pin.length} chiffre(s) tapé(s)`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={cn("size-4 rounded-full border-2 border-primary", i < pin.length && "bg-primary")} />
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mx-auto grid max-w-72 grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onPress={() => press(d)} disabled={pending}>
            {d}
          </Key>
        ))}
        <span />
        <Key onPress={() => press("0")} disabled={pending}>
          0
        </Key>
        <Key onPress={() => setPin((p) => p.slice(0, -1))} disabled={pending || pin.length === 0} label="Effacer">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Delete className="size-5" />}
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onPress, disabled, label }: { children: React.ReactNode; onPress: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className="num grid h-16 place-items-center rounded-2xl border bg-card text-2xl font-semibold transition-colors hover:bg-muted active:bg-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}
