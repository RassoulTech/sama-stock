"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITIES, isActivity, type Activity } from "@/lib/domain/sales";
import { adminUpdateBusiness } from "@/server/actions/admin";

type Info = { name: string; activity: string; phone: string | null; city: string | null; address: string | null };

/** Carte « Informations » de la fiche commerce : lecture, et correction par l'administrateur. */
export function BusinessInfoCard({ businessId, info, rows }: { businessId: string; info: Info; rows: [string, string][] }) {
  const router = useRouter();
  const initial = {
    name: info.name,
    activity: (isActivity(info.activity) ? info.activity : "autre") as Activity,
    phone: info.phone ?? "",
    city: info.city ?? "",
    address: info.address ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);

  function open() {
    setForm(initial);
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await adminUpdateBusiness(businessId, form);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Infos enregistrées");
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Informations</CardTitle>
        {!editing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={open}>
              <Pencil /> Modifier
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={submit} className="space-y-3">
            <FormField label="Nom du commerce" htmlFor="info-name" hint="Son adresse de connexion ne change pas.">
              <Input id="info-name" required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </FormField>
            <FormField label="Activité">
              <Select value={form.activity} onValueChange={(v) => setForm({ ...form, activity: v as Activity })}>
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
            <FormField label="Téléphone (WhatsApp)" htmlFor="info-phone">
              <Input id="info-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77 123 45 67" />
            </FormField>
            <FormField label="Ville" htmlFor="info-city">
              <Input id="info-city" maxLength={60} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex. : Thiès" />
            </FormField>
            <FormField label="Adresse" htmlFor="info-address">
              <Input id="info-address" maxLength={160} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ex. : Marché central, en face de la pharmacie" />
            </FormField>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />} Enregistrer
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-2.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="min-w-0 text-right font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
