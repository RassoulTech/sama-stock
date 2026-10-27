import { formatDate, formatDateTime, formatFCFA, formatQty } from "./format";
import { LEGAL } from "./legal";

export function waLink(phone: string | null | undefined, text: string): string {
  const target = phone ? phone.replace(/\D/g, "") : "";
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

type MessageItem = { name: string; quantity: number; unit: string; lineTotal: number };

function itemLines(items: MessageItem[]): string[] {
  return items.map((i) => `${formatQty(i.quantity, i.unit)} × ${i.name} : ${formatFCFA(i.lineTotal)}`);
}

export function receiptMessage(input: {
  businessName: string;
  number: string;
  date: Date;
  items: MessageItem[];
  discount: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;
  paymentLabel: string;
}): string {
  const lines = [
    `*${input.businessName}*`,
    `Reçu ${input.number} — ${formatDateTime(input.date)}`,
    "",
    ...itemLines(input.items),
    "",
  ];
  if (input.discount > 0) lines.push(`Remise : -${formatFCFA(input.discount)}`);
  if (input.deliveryFee > 0) lines.push(`Livraison : ${formatFCFA(input.deliveryFee)}`);
  lines.push(`*Total : ${formatFCFA(input.total)}*`);
  if (input.amountPaid > 0) lines.push(`Payé (${input.paymentLabel}) : ${formatFCFA(input.amountPaid)}`);
  const rest = input.total - input.amountPaid;
  if (rest > 0) lines.push(`Reste à payer : ${formatFCFA(rest)}`);
  lines.push("", "Merci pour votre confiance !");
  return lines.join("\n");
}

/** Message qui accompagne le PDF d'un devis ou d'une facture. */
export function documentMessage(input: {
  businessName: string;
  kind: "devis" | "facture";
  number: string;
  date: Date;
  total: number;
  rest?: number;
  validUntil?: Date | null;
}): string {
  const lines = [
    `*${input.businessName}*`,
    `${input.kind === "devis" ? "Devis" : "Facture"} ${input.number} du ${formatDate(input.date)}`,
    `Montant : *${formatFCFA(input.total)}*`,
  ];
  if (input.kind === "facture" && input.rest !== undefined) lines.push(input.rest > 0 ? `Reste à payer : ${formatFCFA(input.rest)}` : "Facture réglée. Merci !");
  if (input.kind === "devis" && input.validUntil) lines.push(`Valable jusqu'au ${formatDate(input.validUntil)}`);
  lines.push("", `Voici votre ${input.kind === "devis" ? "devis" : "facture"} en PDF. Merci pour votre confiance !`);
  return lines.join("\n");
}

/** Message qui accompagne le PDF de la facture (ou du devis) d'une licence envoyé au commerçant. */
export function licenceDocumentMessage(input: {
  kind: "devis" | "facture";
  number: string;
  ownerName: string | null;
  businessName: string;
  packLabel: string;
  total: number;
  paid: number;
}): string {
  const hello = `Bonjour${input.ownerName ? ` ${input.ownerName.split(" ")[0]}` : ""},`;
  const rest = Math.max(0, input.total - input.paid);
  const lines = [
    hello,
    `Voici ${input.kind === "facture" ? "la facture" : "le devis"} N° ${input.number} de votre application Sama Stock pour *${input.businessName}* (licence ${input.packLabel}, à vie).`,
    `Montant : *${formatFCFA(input.total)}*`,
  ];
  if (input.kind === "facture") lines.push(rest > 0 ? `Déjà payé : ${formatFCFA(input.paid)} · Reste à payer : ${formatFCFA(rest)}` : "Entièrement payée. Merci pour votre confiance !");
  else lines.push("Acompte de 50 % à la commande, solde à l'installation.");
  lines.push("", "L'équipe Sama Stock");
  return lines.join("\n");
}

export function orderMessage(input: {
  businessName: string;
  customerName: string;
  number: string;
  statusLabel: string;
  items: MessageItem[];
  deliveryFee: number;
  total: number;
  amountPaid: number;
  deliveryAddress?: string | null;
}): string {
  const lines = [
    `Bonjour ${input.customerName},`,
    `Voici le récapitulatif de votre commande *${input.number}* chez *${input.businessName}* :`,
    "",
    ...itemLines(input.items),
  ];
  if (input.deliveryFee > 0) lines.push(`Livraison : ${formatFCFA(input.deliveryFee)}`);
  lines.push(`*Total : ${formatFCFA(input.total)}*`);
  if (input.amountPaid > 0) lines.push(`Déjà payé : ${formatFCFA(input.amountPaid)}`);
  lines.push("", `Statut : ${input.statusLabel}`);
  if (input.deliveryAddress) lines.push(`Adresse de livraison : ${input.deliveryAddress}`);
  lines.push("", "Merci pour votre commande !");
  return lines.join("\n");
}

export function debtReminderMessage(customerName: string, amount: number, businessName: string): string {
  return [
    `Bonjour ${customerName},`,
    `Petit rappel amical de *${businessName}* : il vous reste *${formatFCFA(amount)}* à régler.`,
    "Vous pouvez payer en espèces, par Wave ou Orange Money.",
    "Merci beaucoup et à bientôt !",
  ].join("\n");
}

export function invitationMessage(businessName: string, roleLabel: string, link: string): string {
  return [
    "Bonjour !",
    `Vous êtes invité(e) à rejoindre *${businessName}* sur Sama Stock en tant que *${roleLabel}*.`,
    `Créez votre compte ici : ${link}`,
  ].join("\n");
}

/** Lien WhatsApp vers l'équipe Sama Stock (ventes, installation, assistance), message déjà écrit. */
export function salesLink(text: string): string {
  return waLink(LEGAL.whatsapp, text);
}

export const INSTALL_MESSAGE =
  "Bonjour Sama Stock, je souhaite une démonstration et l'installation de l'application pour mon commerce.";
