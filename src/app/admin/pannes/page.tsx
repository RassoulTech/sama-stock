import type { Metadata } from "next";
import Link from "next/link";
import { AdminAlertSettings } from "@/components/admin/admin-alert-settings";
import { AppErrorList } from "@/components/admin/app-error-list";
import { PageHeader } from "@/components/shared/page-header";
import { pushPublicKey } from "@/server/push";
import { listAppErrors } from "@/server/queries/app-errors";

export const metadata: Metadata = { title: "Pannes" };

export default async function AdminErrorsPage() {
  const errors = await listAppErrors();
  return (
    <>
      <PageHeader
        title="Pannes"
        description="Les problèmes rencontrés par le site ou les téléphones. Vous êtes prévenu une fois par panne ; marquez-la « Réglée » quand elle est corrigée."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AppErrorList
          errors={errors.map((e) => ({
            id: e.id,
            source: e.source,
            route: e.route,
            message: e.message,
            count: e.count,
            firstSeenAt: e.firstSeenAt.toISOString(),
            lastSeenAt: e.lastSeenAt.toISOString(),
            resolvedAt: e.resolvedAt?.toISOString() ?? null,
          }))}
        />
        <aside className="space-y-3">
          <AdminAlertSettings publicKey={pushPublicKey()} />
          <p className="px-1 text-xs text-muted-foreground">
            Pour vérifier la page d&apos;erreur et l&apos;alerte :{" "}
            <Link href="/admin/pannes/essai" className="font-medium text-primary hover:underline">
              provoquer une panne d&apos;essai
            </Link>
            .
          </p>
        </aside>
      </div>
    </>
  );
}
