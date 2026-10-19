import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleEnabled } from "@/lib/auth";
import { SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { isSaspayEnabled } from "@/server/saspay";
import { databaseStatus } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Système" };

type Level = "ok" | "warn" | "off";

const LEVELS: Record<Level, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-success", label: "Opérationnel" },
  warn: { icon: CircleAlert, className: "text-warning dark:text-saffron", label: "À vérifier" },
  off: { icon: CircleX, className: "text-destructive", label: "Non configuré" },
};

function Row({ name, level, detail }: { name: string; level: Level; detail: React.ReactNode }) {
  const { icon: Icon, className, label } = LEVELS[level];
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="flex items-center gap-2.5 font-medium">
        <Icon className={cn("size-5 shrink-0", className)} aria-label={label} />
        {name}
      </span>
      <span className="pl-7.5 text-sm text-muted-foreground sm:pl-0 sm:text-right">{detail}</span>
    </li>
  );
}

export default async function AdminSystemPage() {
  const db = await databaseStatus().catch(() => null);
  const saspayKey = process.env.SASPAY_API_KEY ?? "";
  const saspayMode = saspayKey.startsWith("sk_live_") ? "clé réelle (argent réel)" : saspayKey.startsWith("sk_test_") ? "clé de test" : "";
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").filter((e) => e.trim()).length;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  return (
    <>
      <PageHeader title="Système" description="État des services dont dépend Sama Stock. Aucun secret n'est affiché ici." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Services</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              <Row
                name="Base de données"
                level={db ? (db.latencyMs > 800 ? "warn" : "ok") : "off"}
                detail={db ? `PostgreSQL ${db.version} · ${db.size} · réponse en ${db.latencyMs} ms` : "Injoignable"}
              />
              <Row
                name="Paiement Wave / Orange Money"
                level={isSaspayEnabled ? "ok" : "off"}
                detail={isSaspayEnabled ? `SasPay · ${saspayMode}` : "Clé SasPay absente"}
              />
              <Row
                name="Notifications de paiement"
                level={process.env.SASPAY_WEBHOOK_SECRET ? "ok" : "warn"}
                detail={
                  process.env.SASPAY_WEBHOOK_SECRET
                    ? "Signées et vérifiées"
                    : "Non configurées : les paiements s'activent au retour du client ou via « Vérifier »"
                }
              />
              <Row
                name="Connexion avec Google"
                level={isGoogleEnabled ? "ok" : "off"}
                detail={isGoogleEnabled ? "Activée" : "Clés Google absentes"}
              />
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              <Row name="Adresse du site" level="ok" detail={SITE_URL} />
              <Row
                name="Hébergement"
                level="ok"
                detail={
                  process.env.VERCEL
                    ? `Vercel · ${process.env.VERCEL_ENV === "production" ? "production" : (process.env.VERCEL_ENV ?? "—")} · région ${process.env.VERCEL_REGION ?? "—"}`
                    : "Ordinateur local"
                }
              />
              <Row name="Version déployée" level="ok" detail={commit ? `Commit ${commit}` : "Version locale"} />
              <Row
                name="Super administrateurs"
                level={admins > 0 ? "ok" : "warn"}
                detail={`${admins} adresse${admins > 1 ? "s" : ""} autorisée${admins > 1 ? "s" : ""}`}
              />
              <Row name="Tables de la base" level="ok" detail={db ? `${db.tables} tables` : "—"} />
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
