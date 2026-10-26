"use client";

import { Copy, ExternalLink, KeyRound, Link2, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormField, SuffixInput } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { isBrandColor, DEFAULT_BRAND, type BrandColor } from "@/lib/domain/brand";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminRecordLicensePayment, adminResetOwnerPassword, adminSellLicense, adminUpdateBrand, adminUpdateSlug } from "@/server/actions/licences";
import { AccessShare } from "./access-share";
import { ColorPicker, LogoPicker } from "./brand-picker";
import { newSaleDraft, SaleFields, saleInput } from "./sale-fields";

/** Argent reçu : solde de la licence, ou maintenance annuelle (prolonge d'un an). */
export function LicensePaymentForm({ saleId, balance, maintenancePrice }: { saleId: string; balance: number; maintenancePrice: number }) {
  const router = useRouter();
  const [kind, setKind] = useState<"licence" | "maintenance">(balance > 0 ? "licence" : "maintenance");
  const [amount, setAmount] = useState(String(balance > 0 ? balance : maintenancePrice));
  const [method, setMethod] = useState<LicensePaymentMethod>("wave");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function choose(k: "licence" | "maintenance") {
    setKind(k);
    setAmount(String(k === "licence" ? balance : maintenancePrice));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await adminRecordLicensePayment(saleId, { kind, amount, method, note });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(kind === "maintenance" ? "Maintenance renouvelée pour un an" : "Paiement enregistré");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {(
          [
            ["licence", "Paiement de la licence", balance > 0 ? `Reste ${formatFCFA(balance)}` : "Déjà soldée"],
            ["maintenance", "Maintenance d'un an", `${formatFCFA(maintenancePrice)} par an`],
          ] as const
        ).map(([k, title, hint]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => choose(k)}
            className={cn("rounded-xl border p-3 text-left text-sm", kind === k && "border-primary bg-accent/50 ring-1 ring-primary")}
          >
            <span className="block font-semibold">{title}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Montant reçu" htmlFor="pay-amount">
          <SuffixInput id="pay-amount" suffix="FCFA" min={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Payé par">
          <Select value={method} onValueChange={(v) => setMethod(v as LicensePaymentMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Note (facultatif)" htmlFor="pay-note">
        <Input id="pay-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : solde à l'installation" />
      </FormField>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="animate-spin" />}
        {kind === "maintenance" ? "Enregistrer et prolonger d'un an" : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}

/** Recrée un mot de passe provisoire et affiche de quoi l'envoyer au client. */
export function LicenseAccess({
  businessId,
  businessName,
  phone,
  slug,
  licensed,
}: {
  businessId: string;
  businessName: string;
  phone: string | null;
  slug: string | null;
  licensed: boolean;
}) {
  const [access, setAccess] = useState<{ email: string; name: string; password: string; slug: string | null } | null>(null);

  if (access) {
    return (
      <AccessShare
        ownerName={access.name}
        businessName={businessName}
        email={access.email}
        password={access.password}
        phone={phone}
        slug={access.slug ?? slug}
      />
    );
  }
  return (
    <div className="space-y-4">
      {licensed && <LoginAddress businessId={businessId} slug={slug} />}
      <p className="text-sm text-muted-foreground">Le client a perdu son mot de passe ? Créez-en un nouveau et envoyez-le-lui sur WhatsApp, avec le QR code de connexion.</p>
      <ConfirmAction
        trigger={
          <Button variant="outline">
            <KeyRound /> Nouveau mot de passe
          </Button>
        }
        title="Créer un nouveau mot de passe ?"
        description="L'ancien mot de passe ne marchera plus. Le nouveau s'affiche une seule fois, avec de quoi l'envoyer au client."
        confirmLabel="Créer le mot de passe"
        successMessage="Nouveau mot de passe créé"
        action={async () => {
          const res = await adminResetOwnerPassword(businessId);
          if (res.ok) setAccess(res.data);
          return res;
        }}
      />
    </div>
  );
}

/** Adresse de la page de connexion de la boutique (…/b/son-nom) : copier, ouvrir ou modifier. */
function LoginAddress({ businessId, slug }: { businessId: string; slug: string | null }) {
  const router = useRouter();
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug ?? "");
  const [pending, setPending] = useState(false);
  const url = slug ? `${origin}/b/${slug}` : "";

  async function save(wanted?: string) {
    setPending(true);
    const res = await adminUpdateSlug(businessId, { slug: wanted });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setValue(res.data.slug);
    setEditing(false);
    toast.success("Adresse enregistrée");
    router.refresh();
  }

  if (!slug) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-sm">
        <p className="text-muted-foreground">Cette boutique n&apos;a pas encore sa page de connexion personnalisée.</p>
        <Button className="mt-2" size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Créer l&apos;adresse
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">Adresse de connexion de la boutique (à son nom, sans Google)</p>
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save(value);
          }}
        >
          <span className="text-sm text-muted-foreground">…/b/</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            className="h-9 w-56 font-mono"
            aria-label="Adresse de la boutique"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending || !value || value === slug}>
            {pending && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </form>
      ) : (
        <>
          <p className="font-mono text-sm font-semibold break-all">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Adresse copiée"), () => {})}
            >
              <Copy /> Copier
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/b/${slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Ouvrir
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil /> Modifier
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Couleur et logo de l'application du client. */
export function BrandForm({ businessId, color, logo }: { businessId: string; color: string | null; logo: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState<BrandColor>(isBrandColor(color) ? color : DEFAULT_BRAND);
  const [image, setImage] = useState(logo);
  const [pending, setPending] = useState(false);
  const changed = value !== (isBrandColor(color) ? color : DEFAULT_BRAND) || image !== logo;

  async function save() {
    setPending(true);
    const res = await adminUpdateBrand(businessId, { brandColor: value, ...(image !== logo ? { logo: image ?? "" } : {}) });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Application personnalisée");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <LogoPicker value={image} onChange={setImage} />
      <ColorPicker value={value} onChange={setValue} />
      <Button disabled={!changed || pending} onClick={() => void save()}>
        {pending && <Loader2 className="animate-spin" />}
        Enregistrer
      </Button>
    </div>
  );
}

/** Vendre une licence à un commerce déjà inscrit (essai ou abonnement en ligne). */
export function SellLicenseForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sale, setSale] = useState(newSaleDraft());
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const res = await adminSellLicense(businessId, saleInput(sale));
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Licence ${res.data.number} activée`);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ce commerçant préfère acheter son application une fois ? Vendez-lui une licence : elle n&apos;expire jamais.</p>
        <Button onClick={() => setOpen(true)}>Vendre une licence</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SaleFields value={sale} onChange={setSale} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => void submit()}>
          {pending && <Loader2 className="animate-spin" />}
          Activer la licence
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
