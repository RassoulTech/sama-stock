import { BadgeCheck, Check, Mail, MessageCircle, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { isLicensePack, LICENSE_PACKS, limitLabel } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { LEGAL } from "@/lib/legal";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { balanceOf, type getLicenseSale } from "@/server/queries/licences";

type Detail = NonNullable<Awaited<ReturnType<typeof getLicenseSale>>>;

const daysUntil = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);

/** Page « Votre application » d'un commerce qui a acheté sa licence. */
export function LicenseView({ detail, businessName, support }: { detail: Detail | null; businessName: string; support: string | null }) {
  const sale = detail?.sale ?? null;
  const pack = sale && isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack] : null;
  const end = sale?.maintenance_ends_at ? new Date(sale.maintenance_ends_at) : null;
  const days = end ? daysUntil(end) : 0;
  const rest = sale ? balanceOf(sale) : 0;
  const message = `Bonjour Sama Stock, je souhaite renouveler la maintenance de mon application *${businessName}*${sale ? ` (licence ${sale.number})` : ""}.`;

  return (
    <>
      <PageHeader title="Votre application" description="Achetée une fois, elle est à vous pour toujours." />

      <Card className="mb-5 border-primary/30">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-primary">
            <BadgeCheck className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              Licence {pack?.label ?? ""} <StatusPill tone="green">À vie</StatusPill>
            </p>
            <p className="text-sm text-muted-foreground">
              {sale ? `${sale.number} · activée le ${formatDate(sale.activated_at ?? sale.created_at)}` : "Licence active"}
              {pack && ` · ${limitLabel(pack.limits.maxProducts, "produits", { lowercase: true })}`}
            </p>
          </div>
          {rest > 0 && (
            <div className="rounded-xl bg-saffron/12 px-4 py-2 text-sm">
              Reste à payer : <span className="num font-semibold">{formatFCFA(rest)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <Wrench className="size-4 text-primary" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={cn("text-sm font-semibold", days <= 0 ? "text-destructive" : days <= 30 && "text-warning dark:text-saffron")}>
              {end ? (days <= 0 ? `Terminée le ${formatDate(end)}` : `Active jusqu'au ${formatDate(end)} (${days} jour${days > 1 ? "s" : ""})`) : "—"}
            </p>
            <ul className="space-y-1.5 text-sm">
              {["Assistance par WhatsApp et téléphone", "Nouvelles fonctions et améliorations", "Sauvegardes de vos données"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Votre application continue de fonctionner même sans maintenance.
              {sale && <> Pour la prolonger d&apos;un an : {formatFCFA(sale.maintenance_price)}.</>}
            </p>
            {support ? (
              <Button asChild>
                <a href={waLink(support, message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Renouveler ou demander de l&apos;aide
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`Maintenance — ${businessName}`)}`}>
                  <Mail /> Écrire à Sama Stock
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Vos paiements</CardTitle>
          </CardHeader>
          <CardContent>
            {!detail || detail.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
            ) : (
              <ul className="divide-y text-sm">
                {detail.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <span className="block font-medium">{p.kind === "maintenance" ? "Maintenance (1 an)" : "Licence"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(p.paid_at)} · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                      </span>
                    </span>
                    <span className="num font-semibold">{formatFCFA(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {sale && (
              <p className="mt-4 border-t pt-3 text-sm">
                Prix de la licence : <span className="num font-semibold">{formatFCFA(sale.agreed_price)}</span>
                {rest > 0 ? (
                  <span className="text-warning dark:text-saffron"> · reste {formatFCFA(rest)}</span>
                ) : (
                  <span className="text-success"> · entièrement payée</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
