/** Actions des administrateurs, telles qu'affichées dans le journal. */
export const ADMIN_ACTIONS = {
  plan: "Formule modifiée",
  extend: "Période prolongée",
  expire: "Expiration forcée",
  cash: "Paiement en espèces",
  suspend: "Commerce suspendu",
  resume: "Commerce réactivé",
  revoke_session: "Appareil déconnecté",
  revoke_user: "Utilisateur déconnecté partout",
  note: "Note interne",
  license: "Licence vendue",
  license_payment: "Paiement de licence",
  maintenance: "Maintenance renouvelée",
  license_cancel: "Licence annulée",
  reset_password: "Nouveau mot de passe",
  brand: "Personnalisation",
  import: "Produits importés",
  address: "Adresse de connexion",
} as const;

/** Moyens de paiement d'une licence ou d'une maintenance. */
export const LICENSE_PAYMENT_METHODS = {
  wave: "Wave",
  orange_money: "Orange Money",
  especes: "Espèces",
  virement: "Virement bancaire",
  autre: "Autre",
} as const;

export type LicensePaymentMethod = keyof typeof LICENSE_PAYMENT_METHODS;

export type AdminAction = keyof typeof ADMIN_ACTIONS;

export function isAdminAction(value: string): value is AdminAction {
  return value in ADMIN_ACTIONS;
}

/**
 * Santé d'un commerce d'après sa dernière activité (vente, mouvement de stock) :
 * « active » sous 7 jours, « calme » sous 30 jours, « inactive » au-delà, « jamais » s'il n'a encore rien fait.
 */
export type BusinessHealth = "active" | "calme" | "inactive" | "jamais";

export const HEALTH_LABELS: Record<BusinessHealth, string> = {
  active: "En activité",
  calme: "Calme",
  inactive: "Inactif",
  jamais: "Jamais utilisé",
};

/** Libellé court de la formule et de son état : « Essai en cours », « Pro · Actif », « Business · Expiré ». */
export function planBadgeText(planLabel: string, status: "trialing" | "active" | "expired" | "suspended", statusLabel: string): string {
  if (status === "trialing") return "Essai en cours";
  // Licence achetée : elle ne s'arrête pas, seul le nom compte (sauf suspension)
  if (planLabel.startsWith("Licence") && status === "active") return planLabel;
  return `${planLabel} · ${statusLabel}`;
}

export const HEALTH_TONES: Record<BusinessHealth, "green" | "blue" | "saffron" | "red"> = {
  active: "green",
  calme: "blue",
  inactive: "saffron",
  jamais: "red",
};

const DAY = 86_400_000;

export function businessHealth(lastActivity: Date | string | null, now = Date.now()): BusinessHealth {
  if (!lastActivity) return "jamais";
  const days = (now - new Date(lastActivity).getTime()) / DAY;
  if (days <= 7) return "active";
  if (days <= 30) return "calme";
  return "inactive";
}

/** Message WhatsApp de relance selon la situation du commerce (ton poli, en français simple). */
export function adminReminderMessage(input: {
  ownerName: string | null;
  businessName: string;
  status: "trialing" | "active" | "expired" | "suspended";
  daysLeft: number;
}): string {
  const hello = `Bonjour${input.ownerName ? ` ${input.ownerName.split(" ")[0]}` : ""},`;
  const sign = "L'équipe Sama Stock";
  if (input.status === "expired") {
    return [
      hello,
      `L'abonnement de *${input.businessName}* sur Sama Stock est arrivé à son terme : vos données sont gardées, mais elles sont en consultation seule.`,
      "Vous pouvez le renouveler en 1 minute depuis la page Abonnement (Wave ou Orange Money). Besoin d'aide ? Répondez simplement à ce message.",
      sign,
    ].join("\n");
  }
  if (input.status === "trialing") {
    const when = input.daysLeft <= 0 ? "aujourd'hui" : input.daysLeft === 1 ? "demain" : `dans ${input.daysLeft} jours`;
    return [
      hello,
      `Votre essai gratuit de Sama Stock pour *${input.businessName}* se termine ${when}.`,
      "Comment se passe la prise en main ? Si vous avez la moindre question, répondez à ce message : nous vous aidons avec plaisir.",
      sign,
    ].join("\n");
  }
  return [hello, `Nous prenons des nouvelles de *${input.businessName}* : tout se passe bien avec Sama Stock ?`, sign].join("\n");
}

/** Message d'accompagnement : inscrit sans avoir commencé, ou devenu inactif. */
export function adminCheckInMessage(input: { ownerName: string | null; businessName: string; reason: "not_started" | "quiet" }): string {
  const hello = `Bonjour${input.ownerName ? ` ${input.ownerName.split(" ")[0]}` : ""},`;
  const body =
    input.reason === "not_started"
      ? `Merci d'avoir créé *${input.businessName}* sur Sama Stock ! Voulez-vous qu'on vous aide à ajouter vos premiers produits ? Cela prend 5 minutes, et on peut le faire ensemble par téléphone.`
      : `Cela fait quelque temps que nous n'avons pas vu *${input.businessName}* sur Sama Stock. Quelque chose vous bloque ? Dites-nous : nous sommes là pour vous aider.`;
  return [hello, body, "L'équipe Sama Stock"].join("\n");
}
