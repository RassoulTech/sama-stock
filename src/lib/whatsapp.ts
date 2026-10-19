import { formatDateTime, formatFCFA, formatQty } from "./format";

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
