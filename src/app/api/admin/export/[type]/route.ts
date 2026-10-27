import { HEALTH_LABELS } from "@/lib/domain/admin";
import { isRole, ROLE_LABELS } from "@/lib/domain/permissions";
import { PLAN_STATUS_LABELS } from "@/lib/domain/plans";
import { ACTIVITIES, type Activity } from "@/lib/domain/sales";
import { getContext } from "@/server/context";
import { FORMATS, newWorkbook, startSheet, workbookResponse, writeTable, type Column } from "@/server/excel";
import { listAllBusinesses, listAllUsers } from "@/server/queries/admin";

const META = (title: string) => ({
  business: "Sama Stock · Administration",
  period: `${title} au ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" })}`,
});
const stamp = () => new Date().toISOString().slice(0, 10);

/** Export Excel des listes de l'administration (super administrateurs uniquement). */
export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const ctx = await getContext();
  if (!ctx?.isSuperAdmin) return new Response("Réservé aux administrateurs.", { status: 403 });
  const { type } = await params;

  if (type === "commerces") {
    const rows = await listAllBusinesses();
    const columns: Column[] = [
      { header: "Commerce", width: 28 },
      { header: "Activité", width: 16 },
      { header: "Ville", width: 14 },
      { header: "Propriétaire", width: 22 },
      { header: "E-mail", width: 28 },
      { header: "Téléphone", width: 16 },
      { header: "Formule", width: 10 },
      { header: "Statut", width: 14 },
      { header: "Fin de période", width: 13, format: FORMATS.day },
      { header: "Jours restants", width: 10, format: FORMATS.number },
      { header: "Utilisation", width: 16 },
      { header: "Dernière activité", width: 14, format: FORMATS.day },
      { header: "Produits", width: 10, format: FORMATS.number },
      { header: "Membres", width: 10, format: FORMATS.number },
      { header: "Ventes (30 j)", width: 11, format: FORMATS.number },
      { header: "Vendu (30 j)", width: 15, format: FORMATS.money, sum: true },
      { header: "Total payé", width: 14, format: FORMATS.money, sum: true },
      { header: "Inscrit le", width: 12, format: FORMATS.day },
    ];
    const wb = newWorkbook("Commerces · Sama Stock");
    const { ws, row } = startSheet(wb, { name: "Commerces", title: "Commerces inscrits", meta: META(`${rows.length} commerces`), widths: columns.map((c) => c.width) });
    writeTable(
      ws,
      row,
      columns,
      rows.map((r) => [
        r.name,
        ACTIVITIES[r.activity as Activity] ?? r.activity,
        r.city ?? "",
        r.ownerName ?? "",
        r.ownerEmail ?? "",
        r.phone ?? "",
        r.state.label,
        PLAN_STATUS_LABELS[r.state.status],
        r.state.endsAt,
        r.state.status === "active" || r.state.status === "trialing" ? r.state.daysLeft : null,
        HEALTH_LABELS[r.health],
        r.lastActivity,
        r.productCount,
        r.memberCount,
        r.sales30,
        r.revenue30,
        r.paidTotal,
        r.createdAt,
      ]),
      { totalLabel: "Total", freeze: true, filter: true },
    );
    return workbookResponse(wb, `commerces-sama-stock-${stamp()}.xlsx`);
  }

  if (type === "utilisateurs") {
    const users = await listAllUsers();
    const columns: Column[] = [
      { header: "Nom", width: 24 },
      { header: "E-mail", width: 30 },
      { header: "Connexion", width: 18 },
      { header: "Commerces et rôles", width: 40 },
      { header: "Inscrit le", width: 12, format: FORMATS.day },
      { header: "Dernière visite", width: 16, format: FORMATS.dateTime },
    ];
    const wb = newWorkbook("Utilisateurs · Sama Stock");
    const { ws, row } = startSheet(wb, { name: "Utilisateurs", title: "Utilisateurs", meta: META(`${users.length} comptes`), widths: columns.map((c) => c.width) });
    writeTable(
      ws,
      row,
      columns,
      users.map((u) => [
        u.name,
        u.email,
        (u.providers ?? []).map((p) => (p === "google" ? "Google" : p === "credential" ? "E-mail" : p)).join(", "),
        (u.memberships ?? []).map((m) => `${m.business} (${isRole(m.role) ? ROLE_LABELS[m.role] : m.role})`).join(", ") || "Aucun commerce",
        new Date(u.created_at),
        u.last_seen ? new Date(u.last_seen) : null,
      ]),
      { freeze: true, filter: true },
    );
    return workbookResponse(wb, `utilisateurs-sama-stock-${stamp()}.xlsx`);
  }

  return new Response("Export inconnu.", { status: 404 });
}
