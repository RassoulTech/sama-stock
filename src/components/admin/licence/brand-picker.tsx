"use client";

import { Check, ImagePlus, Loader2, Pipette, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BRAND_PALETTES,
  brandTheme,
  customBrand,
  DEFAULT_BRAND,
  dominantColors,
  isBrandPreset,
  isHexColor,
  parseBrand,
  suggestPalette,
  type BrandPreset,
  type BrandTheme,
  type Palette,
} from "@/lib/domain/brand";
import { initials } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";

/** Choix des couleurs de l'application : une palette toute prête, ou 2 à 3 couleurs libres (ou prises dans le logo). */
export function PalettePicker({
  value,
  onChange,
  logo,
  name = "Ma boutique",
}: {
  value: string;
  onChange: (value: string) => void;
  logo?: string | null;
  name?: string;
}) {
  const [busy, setBusy] = useState(false);
  const palette = parseBrand(value) ?? parseBrand(DEFAULT_BRAND)!;
  const custom = !isBrandPreset(value);
  const theme = brandTheme(value);
  const set = (patch: Partial<Palette>) => onChange(customBrand({ ...palette, ...patch }));

  async function fromLogo() {
    if (!logo) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = logo;
      await img.decode();
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("canvas");
      g.drawImage(img, 0, 0, size, size);
      const suggestion = suggestPalette(dominantColors(g.getImageData(0, 0, size, size).data));
      if (!suggestion) toast.error("Aucune couleur trouvée dans ce logo : choisissez-les à la main.");
      else {
        onChange(customBrand(suggestion));
        toast.success("Couleurs prises dans le logo");
      }
    } catch {
      toast.error("Logo illisible : choisissez les couleurs à la main.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // La largeur du cadre (et non de l'écran) décide du nombre de colonnes : le choix tient aussi dans une colonne étroite
    <div className="@container space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Palettes toutes prêtes</p>
        <div role="radiogroup" aria-label="Palettes de couleurs" className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4">
          {(Object.entries(BRAND_PALETTES) as [BrandPreset, (typeof BRAND_PALETTES)[BrandPreset]][]).map(([key, p]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              onClick={() => onChange(key)}
              className={cn(
                "relative flex min-h-11 flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left text-xs font-medium transition-colors hover:bg-muted/50",
                value === key && "border-primary bg-accent/50 ring-1 ring-primary",
              )}
            >
              <Swatches colors={[p.primary, p.menu, p.highlight]} />
              <span className="leading-tight">{p.label}</span>
              {value === key && <Check className="absolute top-2 right-2 size-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("space-y-3 rounded-xl border p-3.5", custom && "border-primary ring-1 ring-primary")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Ou les couleurs de la boutique {custom && <Check className="size-4 text-primary" />}
          </p>
          {logo && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void fromLogo()}>
              {busy ? <Loader2 className="animate-spin" /> : <Pipette />} Prendre les couleurs du logo
            </Button>
          )}
        </div>
        <ColorRow id="brand-primary" label="Principale" hint="Boutons, liens, carte de l'accueil" value={palette.primary} onChange={(c) => set({ primary: c })} />
        <ColorRow id="brand-menu" label="Menu" hint="Menu, barre du téléphone, icône" value={palette.menu} onChange={(c) => set({ menu: c })} />
        <ColorRow
          id="brand-highlight"
          label="Rappel"
          hint="Page ouverte dans le menu (facultatif)"
          value={palette.highlight}
          onChange={(c) => set({ highlight: c })}
          onClear={() => set({ highlight: null })}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Aperçu</p>
        <BrandPreview theme={theme} logo={logo ?? null} name={name} />
        {theme.adjusted && (
          <p className="text-xs text-muted-foreground">Une couleur était trop claire : elle est un peu foncée pour que le texte blanc reste lisible.</p>
        )}
      </div>
    </div>
  );
}

/** Pastilles d'une palette (la couleur de rappel est facultative). */
function Swatches({ colors }: { colors: (string | null)[] }) {
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {colors.filter(Boolean).map((c, i) => (
        <span key={i} className="size-5 rounded-full ring-2 ring-card" style={{ backgroundColor: c! }} />
      ))}
    </span>
  );
}

/** Une couleur de la palette : pastille (ouvre le sélecteur du téléphone) et code « #1d4ed8 ». */
function ColorRow({
  id,
  label,
  hint,
  value,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  hint: string;
  value: string | null;
  onChange: (color: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <label
        htmlFor={id}
        className={cn(
          "relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full",
          value ? "ring-1 ring-border" : "border-2 border-dashed text-muted-foreground",
        )}
        style={value ? { backgroundColor: value } : undefined}
      >
        {!value && <Plus className="size-4" />}
        <input
          id={id}
          type="color"
          value={value ?? "#f59e0b"}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={`Couleur ${label.toLowerCase()}`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <p className="text-sm font-medium">{label}</p>
          {value && (
            <div className="flex items-center gap-1">
              <HexInput value={value} label={label} onCommit={onChange} />
              {onClear && (
                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Retirer la couleur ${label.toLowerCase()}`} onClick={onClear}>
                  <X />
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** Code de la couleur, modifiable (validé en sortant du champ ou avec Entrée). */
function HexInput({ value, label, onCommit }: { value: string; label: string; onCommit: (color: string) => void }) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value);
  }

  function commit() {
    const v = text.trim().toLowerCase().replace(/^([0-9a-f]{6})$/, "#$1");
    if (isHexColor(v)) onCommit(v);
    else setText(value);
  }

  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      maxLength={7}
      spellCheck={false}
      aria-label={`Code de la couleur ${label.toLowerCase()}`}
      className="h-9 w-[5.5rem] shrink-0 px-2 font-mono text-xs uppercase"
    />
  );
}

/** Petit écran de l'application aux couleurs choisies (déjà corrigées). */
function BrandPreview({ theme, logo, name }: { theme: BrandTheme; logo: string | null; name: string }) {
  return (
    <div aria-hidden className="flex overflow-hidden rounded-xl border bg-[#f8f9f8] text-[#0b1310]">
      <div className="w-28 shrink-0 space-y-1 p-2.5 text-white sm:w-36" style={{ backgroundColor: theme.sidebar }}>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-md bg-white text-[9px] font-bold" style={{ color: theme.primary }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              initials(name)
            )}
          </span>
          <span className="truncate text-[11px] font-semibold">{name}</span>
        </div>
        {["Accueil", "Vendre", "Stock"].map((l, i) => (
          <div key={l} className={cn("relative flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]", i === 0 ? "bg-white/15 font-semibold" : "text-white/75")}>
            {i === 0 && <span className="absolute inset-y-1 -left-1 w-0.5 rounded-full" style={{ backgroundColor: theme.highlight }} />}
            <span className="size-2 rounded-sm" style={{ backgroundColor: i === 0 ? theme.highlight : "rgb(255 255 255 / 0.5)" }} />
            {l}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-2 p-2.5">
        <div className="rounded-lg p-2.5 text-white" style={{ backgroundColor: theme.primary }}>
          <p className="text-[9px] opacity-85">Aujourd&apos;hui</p>
          <p className="text-sm font-semibold">74 000 FCFA</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md px-2 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: theme.primary }}>
            Nouvelle vente
          </span>
          <span className="rounded-md px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: theme.accent, color: theme.accentForeground }}>
            3 commandes
          </span>
        </div>
      </div>
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
      onChange(await compressImage(file, 320, 0.85, "jpeg"));
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
