import { Ban, FileSpreadsheet, FileText } from "lucide-react";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { isLicensePack, LICENSE_PACKS } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminCancelLicenseSale } from "@/server/actions/licences";
import { balanceOf, type getLicenseSale } from "@/server/queries/licences";
import { LicensePaymentForm } from "./license-forms";

type Detail = NonNullable<Awaited<ReturnType<typeof getLicenseSale>>>;

const daysUntil = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);

/** Licence d'un client : prix, paiements, maintenance, documents et actions. */
export function LicenseCard({ detail }: { detail: Detail }) {
  const { sale, payments } = detail;
  const pack = isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack] : null;
  const rest = balanceOf(sale);
  const paidPct = sale.agreed_price > 0 ? Math.min(100, Math.round((sale.paid_licence / sale.agreed_price) * 100)) : 100;
  const end = sale.maintenance_ends_at ? new Date(sale.maintenance_ends_at) : null;
  const daysLeft = end ? daysUntil(end) : 0;

  return (
    <Card id="licence" className="border-primary/30">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 font-semibold">
            Licence {pack?.label ?? sale.pack}
            <StatusPill tone="green">À vie</StatusPill>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {sale.number} · activée le {sale.activated_at ? formatDate(sale.activated_at) : formatDate(sale.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/documents/licence/${sale.id}?type=devis`}>
              <FileText /> Devis
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/documents/licence/${sale.id}?type=facture`}>
              <FileText /> Facture
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Prix convenu</p>
            <p className="num font-semibold">{formatFCFA(sale.agreed_price)}</p>
            {sale.agreed_price < sale.list_price && <p className="text-[11px] text-muted-foreground">catalogue {formatFCFA(sale.list_price)}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payé</p>
            <p className="num font-semibold">
              {formatFCFA(sale.paid_licence)}{" "}
              <span className={cn("text-xs", rest > 0 ? "text-warning dark:text-saffron" : "text-success")}>
                {rest > 0 ? `· reste ${formatFCFA(rest)}` : "· soldée"}
              </span>
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", rest > 0 ? "bg-saffron" : "bg-primary")} style={{ width: `${paidPct}%` }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Maintenance</p>
            <p className={cn("font-semibold", daysLeft <= 0 ? "text-destructive" : daysLeft <= 30 && "text-warning dark:text-saffron")}>
              {end ? (daysLeft <= 0 ? `Terminée le ${formatDate(end)}` : `Jusqu'au ${formatDate(end)}`) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">puis {formatFCFA(sale.maintenance_price)} / an</p>
          </div>
        </div>

        <section className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-semibold">Enregistrer de l&apos;argent reçu</p>
          <LicensePaymentForm saleId={sale.id} balance={rest} maintenancePrice={sale.maintenance_price} />
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">Paiements reçus</p>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y rounded-xl border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {p.kind === "maintenance" ? "Maintenance (1 an)" : p.note || "Licence"} · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                    </span>
                    <span className="block text-xs text-muted-foreground">{formatDate(p.paid_at)}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">{formatFCFA(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/commerces/${sale.business_id}/importer`}>
              <FileSpreadsheet /> Importer ses produits
            </Link>
          </Button>
          <span className="sm:ml-auto">
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Ban /> Annuler la licence
                </Button>
              }
              title="Annuler cette licence ?"
              description="À utiliser en cas de remboursement ou d'erreur. Le commerce perd sa licence et passe en consultation seule. Les paiements restent dans l'historique."
              confirmLabel="Annuler la licence"
              destructive
              successMessage="Licence annulée"
              action={adminCancelLicenseSale.bind(null, sale.id)}
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
