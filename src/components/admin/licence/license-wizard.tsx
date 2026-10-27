"use client";

import { CheckCircle2, FileSpreadsheet, FileText, ImagePlus, Loader2, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_BRAND } from "@/lib/domain/brand";
import { ACTIVITIES, type Activity } from "@/lib/domain/sales";
import { ShareDocumentButton } from "@/components/documents/share-document";
import { adminCreateLicenseClient } from "@/server/actions/licences";
import type { LicenceShare } from "@/server/services/licence-documents";
import { AccessShare } from "./access-share";
import { PalettePicker } from "./brand-picker";
import { newSaleDraft, SaleFields, saleInput, type SaleDraft } from "./sale-fields";

type Created = {
  businessId: string;
  saleId: string;
  number: string;
  /** Adresse de la page de connexion de la boutique (…/b/son-nom). */
  slug: string | null;
  password: string | null;
  email: string;
  phone: string;
  ownerName: string;
  businessName: string;
  /** Facture PDF à envoyer au client (lien signé, message WhatsApp). */
  invoice: LicenceShare | null;
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold">
          <span className="num grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Nouveau client en une fois : commerce, propriétaire, licence, acompte et couleur de son application. */
export function LicenseWizard() {
  const [business, setBusiness] = useState({ name: "", activity: "boutique" as Activity, city: "", phone: "" });
  const [owner, setOwner] = useState({ name: "", email: "" });
  const [sale, setSale] = useState<SaleDraft>(newSaleDraft());
  const [color, setColor] = useState<string>(DEFAULT_BRAND);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await adminCreateLicenseClient({
      client: {
        businessName: business.name,
        activity: business.activity,
        city: business.city,
        phone: business.phone,
        ownerName: owner.name,
        ownerEmail: owner.email,
        brandColor: color,
      },
      sale: saleInput(sale),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCreated(res.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (created) {
    const base = `/admin/commerces/${created.businessId}`;
    return (
      <div className="space-y-5">
        <Card className="border-primary/40">
          <CardContent className="flex items-start gap-3 py-5">
            <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-primary" />
            <div>
              <p className="text-lg font-semibold">Licence {created.number} activée pour {created.businessName}</p>
              <p className="text-sm text-muted-foreground">
                Son application est prête. Envoyez-lui ses accès, puis terminez l&apos;installation avec lui.
              </p>
            </div>
          </CardContent>
        </Card>
        {created.invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Facture du client</CardTitle>
              <p className="text-sm text-muted-foreground">La facture en PDF, avec le QR code de vérification, part directement sur son WhatsApp.</p>
            </CardHeader>
            <CardContent>
              <ShareDocumentButton {...created.invoice} label="Envoyer la facture (PDF)" />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Accès du client</CardTitle>
            {created.password && (
              <p className="text-sm text-muted-foreground">Le mot de passe n&apos;est affiché qu&apos;une fois : envoyez-le maintenant (vous pourrez en recréer un depuis sa fiche).</p>
            )}
          </CardHeader>
          <CardContent>
            <AccessShare ownerName={created.ownerName} businessName={created.businessName} email={created.email} password={created.password} phone={created.phone} slug={created.slug} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Terminer l&apos;installation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              { href: `${base}/importer`, icon: FileSpreadsheet, title: "Importer ses produits", text: "Depuis son fichier Excel ou son cahier recopié" },
              { href: `${base}#personnalisation`, icon: ImagePlus, title: "Ajouter son logo", text: "Il apparaît dans son application et sur ses reçus" },
              { href: `/documents/licence/${created.saleId}?type=facture`, icon: FileText, title: "Voir la facture", text: "À imprimer, à télécharger ou à envoyer" },
              { href: base, icon: Store, title: "Voir sa fiche", text: "Paiements, maintenance, notes" },
            ].map((a) => (
              <Link key={a.title} href={a.href} className="flex gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <a.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.text}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Enregistrer un autre client
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Step n={1} title="Le commerce">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nom du commerce" htmlFor="b-name">
            <Input id="b-name" required maxLength={80} value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} placeholder="Ex. : Quincaillerie Diop" />
          </FormField>
          <FormField label="Activité">
            <Select value={business.activity} onValueChange={(v) => setBusiness({ ...business, activity: v as Activity })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ACTIVITIES) as [Activity, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Téléphone (WhatsApp)" htmlFor="b-phone" hint="Pour lui envoyer ses accès et le relancer.">
            <Input id="b-phone" required type="tel" inputMode="tel" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} placeholder="77 123 45 67" />
          </FormField>
          <FormField label="Ville" htmlFor="b-city">
            <Input id="b-city" maxLength={60} value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} placeholder="Ex. : Thiès" />
          </FormField>
        </div>
      </Step>

      <Step n={2} title="Le propriétaire">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nom complet" htmlFor="o-name">
            <Input id="o-name" required maxLength={80} value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
          </FormField>
          <FormField label="E-mail" htmlFor="o-email" hint="Il s'en sert pour se connecter. S'il a déjà un compte Sama Stock, il le garde.">
            <Input id="o-email" required type="email" inputMode="email" autoComplete="off" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
          </FormField>
        </div>
      </Step>

      <Step n={3} title="La licence">
        <SaleFields value={sale} onChange={setSale} />
      </Step>

      <Step n={4} title="Les couleurs de son application">
        <p className="mb-3 text-sm text-muted-foreground">
          Son application prend ces couleurs. Le logo s&apos;ajoute juste après, depuis sa fiche : vous pourrez alors prendre les couleurs du logo.
        </p>
        <PalettePicker value={color} onChange={setColor} name={business.name.trim() || undefined} />
      </Step>

      {/* Sur téléphone, le bouton reste à la fin du formulaire pour ne pas cacher les champs */}
      <div className="flex justify-end lg:sticky lg:bottom-4 lg:z-10">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto lg:shadow-lg">
          {pending && <Loader2 className="animate-spin" />}
          Créer le client et activer la licence
        </Button>
      </div>
    </form>
  );
}
