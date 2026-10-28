import { CheckCircle2, ChevronRight, HandCoins, Moon, PackageOpen, PhoneCall, RotateCcw, TimerOff, Wrench } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { adminCheckInMessage, adminReminderMessage } from "@/lib/domain/admin";
import { formatDate, formatFCFA } from "@/lib/format";
import type { AdminBusinessRow, todoLists } from "@/server/queries/admin";
import { balanceOf, type LicenseSaleRow, type licenseSummary } from "@/server/queries/licences";
import { ContactButtons, relativeDay } from "./contact-buttons";

type Todo = ReturnType<typeof todoLists>;
type LicenceTodo = Pick<ReturnType<typeof licenseSummary>, "toCollect" | "maintenanceSoon" | "maintenanceOver" | "followUps">;

interface LicenceSection {
  key: keyof LicenceTodo;
  title: string;
  icon: LucideIcon;
  tone: string;
  detail: (s: LicenseSaleRow) => string;
  message: (s: LicenseSaleRow) => string;
  href: string;
}

const hello = (s: LicenseSaleRow) => `Bonjour${s.owner_name ? ` ${s.owner_name.split(" ")[0]}` : ""},`;
const SIGN = "L'équipe Sama Stock";

const LICENCE_SECTIONS: LicenceSection[] = [
  {
    key: "toCollect",
    title: "Licences à encaisser",
    icon: HandCoins,
    tone: "bg-saffron/15 text-warning dark:text-saffron",
    detail: (s) => `Reste ${formatFCFA(balanceOf(s))} sur ${formatFCFA(s.agreed_price)} · ${s.number}`,
    message: (s) =>
      [
        hello(s),
        `Petit rappel pour votre application *${s.business}* (Sama Stock) : il reste *${formatFCFA(balanceOf(s))}* à régler. Vous pouvez payer par Wave, Orange Money ou en espèces.`,
        "Merci !",
        SIGN,
      ].join("\n"),
    href: "/admin/licences?vue=a-encaisser",
  },
  {
    key: "maintenanceSoon",
    title: "Maintenances à renouveler",
    icon: Wrench,
    tone: "bg-accent text-primary",
    detail: (s) => `Fin le ${formatDate(s.maintenance_ends_at!)} · ${formatFCFA(s.maintenance_price)} / 6 mois`,
    message: (s) =>
      [
        hello(s),
        `La maintenance de votre application *${s.business}* (assistance, nouveautés, sauvegardes) se termine le ${formatDate(s.maintenance_ends_at!)}. Pour la prolonger de 6 mois : ${formatFCFA(s.maintenance_price)}.`,
        SIGN,
      ].join("\n"),
    href: "/admin/licences?vue=maintenance",
  },
  {
    key: "maintenanceOver",
    title: "Maintenances terminées",
    icon: Wrench,
    tone: "bg-muted text-muted-foreground",
    detail: (s) => `Terminée le ${formatDate(s.maintenance_ends_at!)}`,
    message: (s) =>
      [
        hello(s),
        `Votre application *${s.business}* continue de fonctionner, mais sa maintenance est terminée. Pour retrouver l'assistance et les nouveautés : ${formatFCFA(s.maintenance_price)} tous les 6 mois.`,
        SIGN,
      ].join("\n"),
    href: "/admin/licences?vue=maintenance",
  },
  {
    key: "followUps",
    title: "Appels de suivi après installation",
    icon: PhoneCall,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    detail: (s) => `Installé ${relativeDay(s.activated_at)} : tout se passe bien ?`,
    message: (s) =>
      [hello(s), `Comment se passe la prise en main de votre application *${s.business}* ? Une question, un souci ? Nous sommes là.`, SIGN].join("\n"),
    href: "/admin/licences",
  },
];

interface Section {
  key: keyof Todo;
  title: string;
  icon: LucideIcon;
  tone: string;
  detail: (r: AdminBusinessRow) => string;
  message: (r: AdminBusinessRow) => string;
  href: string;
}

const reminder = (r: AdminBusinessRow) =>
  adminReminderMessage({ ownerName: r.ownerName, businessName: r.name, status: r.state.status, daysLeft: r.state.daysLeft });

const SECTIONS: Section[] = [
  {
    key: "trialsEnding",
    title: "Essais qui se terminent",
    icon: TimerOff,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    detail: (r) => `Fin ${r.state.daysLeft <= 0 ? "aujourd'hui" : r.state.daysLeft === 1 ? "demain" : `dans ${r.state.daysLeft} jours`} · ${r.productCount} produits · ${r.sales30} ventes`,
    message: reminder,
    href: "/admin/commerces?statut=trialing",
  },
  {
    key: "recentlyExpired",
    title: "Essais terminés, à relancer",
    icon: RotateCcw,
    tone: "bg-saffron/15 text-warning dark:text-saffron",
    detail: (r) => `Essai terminé le ${formatDate(r.state.endsAt!)} · ${r.productCount} produits · ${r.sales30} ventes`,
    message: reminder,
    href: "/admin/commerces?statut=expired",
  },
  {
    key: "notStarted",
    title: "Inscrits sans aucun produit",
    icon: PackageOpen,
    tone: "bg-destructive/10 text-destructive",
    detail: (r) => `Inscrit ${relativeDay(r.createdAt)} · aidez-le à démarrer`,
    message: (r) => adminCheckInMessage({ ownerName: r.ownerName, businessName: r.name, reason: "not_started" }),
    href: "/admin/commerces?activite=jamais",
  },
  {
    key: "goneQuiet",
    title: "Devenus inactifs",
    icon: Moon,
    tone: "bg-muted text-muted-foreground",
    detail: (r) => `Dernière activité ${relativeDay(r.lastActivity)}`,
    message: (r) => adminCheckInMessage({ ownerName: r.ownerName, businessName: r.name, reason: "quiet" }),
    href: "/admin/commerces?activite=inactive",
  },
];

/** Ce que l'équipe doit faire aujourd'hui, avec de quoi contacter chaque commerçant en un geste. */
export function TodoList({ todo, licences, limit = 3 }: { todo: Todo; licences?: LicenceTodo; limit?: number }) {
  const sections = SECTIONS.filter((s) => todo[s.key].length > 0);
  const licenceSections = licences ? LICENCE_SECTIONS.filter((s) => licences[s.key].length > 0) : [];
  if (sections.length === 0 && licenceSections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <p className="font-semibold">Rien d&apos;urgent aujourd&apos;hui</p>
        <p className="text-sm text-muted-foreground">Aucun essai à relancer, aucun commerçant bloqué.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {licences &&
        licenceSections.map((s) => {
          const rows = licences[s.key];
          const Icon = s.icon;
          return (
            <section key={s.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`grid size-7 place-items-center rounded-lg ${s.tone}`}>
                    <Icon className="size-4" />
                  </span>
                  {s.title}
                  <span className="num rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">{rows.length}</span>
                </p>
                {rows.length > limit && (
                  <Link href={s.href} className="inline-flex shrink-0 items-center text-xs font-medium text-primary hover:underline">
                    Tout voir <ChevronRight className="size-3.5" />
                  </Link>
                )}
              </div>
              <ul className="divide-y rounded-xl border">
                {rows.slice(0, limit).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Link href={`/admin/commerces/${r.business_id}`} className="min-w-0 flex-1 hover:text-primary">
                      <span className="block truncate text-sm font-medium">{r.business}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.detail(r)}</span>
                    </Link>
                    <ContactButtons compact phone={r.phone} email={r.owner_email} message={s.message(r)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      {sections.map((s) => {
        const rows = todo[s.key];
        const Icon = s.icon;
        return (
          <section key={s.key}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={`grid size-7 place-items-center rounded-lg ${s.tone}`}>
                  <Icon className="size-4" />
                </span>
                {s.title}
                <span className="num rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">{rows.length}</span>
              </p>
              {rows.length > limit && (
                <Link href={s.href} className="inline-flex shrink-0 items-center text-xs font-medium text-primary hover:underline">
                  Tout voir <ChevronRight className="size-3.5" />
                </Link>
              )}
            </div>
            <ul className="divide-y rounded-xl border">
              {rows.slice(0, limit).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={`/admin/commerces/${r.id}`} className="min-w-0 flex-1 hover:text-primary">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.detail(r)}</span>
                  </Link>
                  <ContactButtons compact phone={r.phone} email={r.ownerEmail} message={s.message(r)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
