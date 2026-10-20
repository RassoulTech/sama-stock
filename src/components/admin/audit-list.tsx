import { Ban, Banknote, CalendarPlus, CheckCircle2, CreditCard, LogOut, NotebookPen, TimerOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ADMIN_ACTIONS, isAdminAction, type AdminAction } from "@/lib/domain/admin";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminAction, { icon: LucideIcon; tone: string }> = {
  plan: { icon: CreditCard, tone: "bg-accent text-primary" },
  extend: { icon: CalendarPlus, tone: "bg-accent text-primary" },
  expire: { icon: TimerOff, tone: "bg-saffron/15 text-warning dark:text-saffron" },
  cash: { icon: Banknote, tone: "bg-success/10 text-success" },
  suspend: { icon: Ban, tone: "bg-destructive/10 text-destructive" },
  resume: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  revoke_session: { icon: LogOut, tone: "bg-muted text-muted-foreground" },
  revoke_user: { icon: LogOut, tone: "bg-destructive/10 text-destructive" },
  note: { icon: NotebookPen, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
};

export interface AuditEntry {
  id: string;
  created_at: Date | string;
  actor_email: string;
  action: string;
  summary: string;
  business_id: string | null;
  business: string | null;
  target_email?: string | null;
}

/** Fil des actions des administrateurs : qui, quoi, sur quel commerce, quand. */
export function AuditList({ entries, compact = false, hideBusiness = false }: { entries: AuditEntry[]; compact?: boolean; hideBusiness?: boolean }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune action enregistrée pour l&apos;instant.</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const kind = isAdminAction(e.action) ? e.action : "note";
        const { icon: Icon, tone } = ICONS[kind];
        return (
          <li key={e.id} className="flex gap-3">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", tone)}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-medium">
                {ADMIN_ACTIONS[kind]}
                {!hideBusiness && e.business && e.business_id && (
                  <>
                    {" · "}
                    <Link href={`/admin/commerces/${e.business_id}`} className="text-primary hover:underline">
                      {e.business}
                    </Link>
                  </>
                )}
              </span>
              <span className={cn("block text-muted-foreground", compact ? "line-clamp-1 text-xs" : "text-[0.8125rem]")}>{e.summary}</span>
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(e.created_at)} · par {e.actor_email}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
