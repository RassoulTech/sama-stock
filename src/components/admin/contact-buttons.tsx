import { Mail, MessageCircle, Phone } from "lucide-react";
import { StatusPill } from "@/components/shared/stock-badge";
import { HEALTH_LABELS, HEALTH_TONES, type BusinessHealth } from "@/lib/domain/admin";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Contacter un commerçant en un geste : WhatsApp (message déjà rédigé), appel, e-mail.
 * `compact` : icônes seules (listes) ; sinon boutons avec libellé (fiche commerce).
 */
export function ContactButtons({
  phone,
  email,
  message,
  compact = false,
  className,
}: {
  phone: string | null;
  email: string | null;
  message: string;
  compact?: boolean;
  className?: string;
}) {
  const item = cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-card font-medium transition-colors hover:bg-muted",
    compact ? "size-8" : "h-9 px-3 text-sm",
  );
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {phone && (
        <a href={waLink(phone, message)} target="_blank" rel="noopener noreferrer" className={cn(item, "text-[#128C7E] dark:text-[#25D366]")} aria-label="Écrire sur WhatsApp">
          <MessageCircle className="size-4" />
          {!compact && "WhatsApp"}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={item} aria-label="Appeler">
          <Phone className="size-4" />
          {!compact && "Appeler"}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={item} aria-label="Envoyer un e-mail">
          <Mail className="size-4" />
          {!compact && "E-mail"}
        </a>
      )}
    </span>
  );
}

export function HealthPill({ health, className }: { health: BusinessHealth; className?: string }) {
  return (
    <StatusPill tone={HEALTH_TONES[health]} className={className}>
      {HEALTH_LABELS[health]}
    </StatusPill>
  );
}

/** « il y a 3 jours », « aujourd'hui », « jamais ». */
export function relativeDay(date: Date | string | null): string {
  if (!date) return "jamais";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

/** Parcours d'activation : chaque étape en barre, avec la part des inscrits qui l'a franchie. */
export function Funnel({ steps }: { steps: { key: string; label: string; count: number }[] }) {
  const base = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.count / base) * 100);
        return (
          <li key={s.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="num grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-primary">{i + 1}</span>
                {s.label}
              </span>
              <span className="num shrink-0 text-muted-foreground">
                <span className="font-semibold text-foreground">{s.count}</span> · {pct} %
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(pct, s.count > 0 ? 3 : 0)}%`, opacity: 1 - i * 0.15 }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
