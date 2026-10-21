"use client";

import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BRAND_COLORS, type BrandColor } from "@/lib/domain/brand";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";

/** Choix de la couleur de l'application parmi une palette fermée (toutes lisibles avec un texte blanc). */
export function ColorPicker({ value, onChange }: { value: BrandColor; onChange: (c: BrandColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Couleur de l'application" className="flex flex-wrap gap-2">
      {(Object.entries(BRAND_COLORS) as [BrandColor, (typeof BRAND_COLORS)[BrandColor]][]).map(([key, c]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(key)}
          className={cn(
            "grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
            value === key ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border",
          )}
          style={{ backgroundColor: c.primary }}
        >
          {value === key && <Check className="size-5 text-white" />}
        </button>
      ))}
    </div>
  );
}

/** Logo du commerce (compressé dans le navigateur avant l'envoi). */
export function LogoPicker({ value, onChange }: { value: string | null; onChange: (logo: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressImage(file, 320, 0.85));
    } catch {
      toast.error("Image illisible. Essayez une photo JPG ou PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 text-muted-foreground hover:border-primary/50"
        aria-label={value ? "Changer le logo" : "Ajouter un logo"}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
          <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" />
        )}
      </button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          {value ? "Changer le logo" : "Ajouter le logo"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 /> Retirer
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
