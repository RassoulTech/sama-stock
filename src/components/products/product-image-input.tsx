"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";

export function ProductImageInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image.");
      return;
    }
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch {
      toast.error("Impossible de lire cette image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        aria-label="Choisir une photo"
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL)
          <img src={value} alt="Aperçu du produit" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Camera className="size-7" />
        )}
      </button>
      <div className="space-y-2">
        <p className="text-sm font-medium">Photo du produit</p>
        <p className="text-xs text-muted-foreground">Facultative. Prenez-la avec votre téléphone.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera />
            {value ? "Changer" : "Ajouter"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 />
              Retirer
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
