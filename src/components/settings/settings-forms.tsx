"use client";

import { Building2, ImagePlus, Loader2, MapPin, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { createLocation, renameLocation, updateBusiness, updateDocumentSettings, updateModules } from "@/server/actions/business";

export function BusinessForm({
  business,
  disabled,
}: {
  business: { name: string; phone: string | null; address: string | null; city: string | null; logo: string | null };
  disabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(business.logo);
  const [logoTouched, setLogoTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await updateBusiness({
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            address: String(form.get("address") ?? ""),
            city: String(form.get("city") ?? ""),
            logo: logoTouched ? (logo ?? "") : undefined,
          });
          if (!res.ok) return setError(res.error);
          toast.success("Informations enregistrées");
          setLogoTouched(false);
          router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/50 text-muted-foreground hover:border-primary/50"
          aria-label="Changer le logo"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local
            <img src={logo} alt="Logo" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
        </button>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Logo (affiché sur les reçus)</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()}>
              {logo ? "Changer" : "Ajouter"}
            </Button>
            {logo && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  setLogo(null);
                  setLogoTouched(true);
                }}
              >
                <Trash2 /> Retirer
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setLogo(await compressImage(file, 256, 0.85, "jpeg"));
              setLogoTouched(true);
            } catch {
              toast.error("Impossible de lire cette image.");
            }
          }}
        />
      </div>
      <FormField label="Nom du commerce" htmlFor="b-name">
        <Input id="b-name" name="name" required minLength={2} defaultValue={business.name} disabled={disabled} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Téléphone" htmlFor="b-phone">
          <Input
            id="b-phone"
            name="phone"
            type="tel"
            defaultValue={business.phone ? formatPhone(business.phone) : ""}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Ville" htmlFor="b-city">
          <Input id="b-city" name="city" defaultValue={business.city ?? ""} disabled={disabled} />
        </FormField>
      </div>
      <FormField label="Adresse" htmlFor="b-address">
        <Input id="b-address" name="address" defaultValue={business.address ?? ""} disabled={disabled} placeholder="Rue, quartier…" />
      </FormField>
      <FormError message={error} />
      <Button type="submit" disabled={disabled || pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}

export function ModulesForm({ modulePos, moduleOrders, disabled }: { modulePos: boolean; moduleOrders: boolean; disabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ modulePos, moduleOrders });
  const [pending, startTransition] = useTransition();

  function toggle(key: "modulePos" | "moduleOrders", value: boolean) {
    const next = { ...state, [key]: value };
    setState(next);
    startTransition(async () => {
      const res = await updateModules(next);
      if (!res.ok) {
        toast.error(res.error);
        setState(state);
      } else toast.success("Modules mis à jour");
      router.refresh();
    });
  }

  const items = [
    { key: "modulePos" as const, label: "Caisse (ventes en boutique)", hint: "Écran « Vendre », reçus et liste des ventes." },
    { key: "moduleOrders" as const, label: "Commandes en ligne", hint: "Suivi des commandes WhatsApp, Instagram, TikTok…" },
  ];

  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key} className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor={i.key} className="font-semibold">
              {i.label}
            </Label>
            <p className="text-xs text-muted-foreground">{i.hint}</p>
          </div>
          <Switch id={i.key} checked={state[i.key]} disabled={disabled || pending} onCheckedChange={(v) => toggle(i.key, v)} />
        </li>
      ))}
      <li className="rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
        La gestion du stock (produits, entrées, sorties, inventaire) est toujours active.
      </li>
    </ul>
  );
}

/** NINEA, RCCM, TVA et mention de bas de page, imprimés sur les devis et factures. */
export function DocumentSettingsForm({
  business,
  disabled,
}: {
  business: { ninea: string | null; rccm: string | null; vatRate: number; documentFooter: string | null; quoteValidityDays: number };
  disabled: boolean;
}) {
  const router = useRouter();
  const [vatRate, setVatRate] = useState(String(business.vatRate === 18 ? 18 : 0));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await updateDocumentSettings({
            ninea: String(form.get("ninea") ?? ""),
            rccm: String(form.get("rccm") ?? ""),
            vatRate: vatRate === "18" ? 18 : 0,
            documentFooter: String(form.get("documentFooter") ?? ""),
            quoteValidityDays: Number(form.get("quoteValidityDays") ?? 15),
          });
          if (!res.ok) return setError(res.error);
          toast.success("Informations des documents enregistrées");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="NINEA" htmlFor="d-ninea" hint="Facultatif, mais demandé sur une facture officielle.">
          <Input id="d-ninea" name="ninea" defaultValue={business.ninea ?? ""} disabled={disabled} autoCapitalize="characters" />
        </FormField>
        <FormField label="RCCM" htmlFor="d-rccm" hint="Ex. SN DKR 2024 A 12345">
          <Input id="d-rccm" name="rccm" defaultValue={business.rccm ?? ""} disabled={disabled} autoCapitalize="characters" />
        </FormField>
      </div>
      <FormField label="TVA" htmlFor="d-vat">
        <Select value={vatRate} onValueChange={setVatRate} disabled={disabled}>
          <SelectTrigger id="d-vat" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Non assujetti à la TVA (le plus courant)</SelectItem>
            <SelectItem value="18">Assujetti : mes prix sont TTC, TVA 18 %</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Validité des devis" htmlFor="d-validity">
        <SuffixInput
          id="d-validity"
          name="quoteValidityDays"
          suffix="jours"
          min={1}
          max={365}
          defaultValue={business.quoteValidityDays}
          disabled={disabled}
        />
      </FormField>
      <FormField label="Mention en bas des documents" htmlFor="d-footer" hint="Conditions de paiement, numéro Wave, remerciements…">
        <Textarea
          id="d-footer"
          name="documentFooter"
          rows={3}
          maxLength={300}
          defaultValue={business.documentFooter ?? ""}
          disabled={disabled}
          placeholder="Paiement à la livraison par Wave ou Orange Money. Merci pour votre confiance !"
        />
      </FormField>
      <FormError message={error} />
      <Button type="submit" disabled={disabled || pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}

function LocationDialog({
  location,
  trigger,
}: {
  location?: { id: string; name: string; kind: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"boutique" | "depot">((location?.kind as "boutique" | "depot") ?? "boutique");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "");
            setError(null);
            startTransition(async () => {
              const res = location ? await renameLocation({ id: location.id, name, kind }) : await createLocation({ name, kind });
              if (!res.ok) return setError(res.error);
              toast.success(location ? "Boutique mise à jour" : "Boutique ajoutée");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{location ? "Modifier" : "Nouvelle boutique ou dépôt"}</DialogTitle>
            <DialogDescription>Chaque boutique ou dépôt a son propre stock.</DialogDescription>
          </DialogHeader>
          <FormField label="Nom" htmlFor="loc-name">
            <Input id="loc-name" name="name" required minLength={2} defaultValue={location?.name} placeholder="Ex. Dépôt Pikine" />
          </FormField>
          <FormField label="Type">
            <Select value={kind} onValueChange={(v) => setKind(v as "boutique" | "depot")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boutique">Boutique</SelectItem>
                <SelectItem value="depot">Dépôt / entrepôt</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationsManager({
  locations,
  max,
  disabled,
  upgradeHint,
}: {
  locations: { id: string; name: string; kind: string }[];
  max: number;
  disabled: boolean;
  upgradeHint: string | null;
}) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-xl border p-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
              {l.kind === "depot" ? <Warehouse className="size-5" /> : <Building2 className="size-5" />}
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.kind === "depot" ? "Dépôt" : "Boutique"}</span>
            </span>
            {!disabled && (
              <LocationDialog
                location={l}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${l.name}`}>
                    <Pencil />
                  </Button>
                }
              />
            )}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5" /> {locations.length} / {max} boutique{max > 1 ? "s ou dépôts" : ""} utilisé{locations.length > 1 ? "s" : ""}
      </p>
      {locations.length < max && !disabled ? (
        <LocationDialog
          trigger={
            <Button variant="outline">
              <Plus /> Ajouter une boutique ou un dépôt
            </Button>
          }
        />
      ) : (
        upgradeHint && <p className="rounded-xl bg-accent/70 p-3 text-sm text-accent-foreground">{upgradeHint}</p>
      )}
    </div>
  );
}
