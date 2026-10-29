import "server-only";
import nodemailer from "nodemailer";
import { MAIN_DOMAIN } from "@/lib/domains";
import { LEGAL } from "@/lib/legal";
import { cleanSecret } from "./backup/key";

/**
 * Envoi d'e-mails.
 * - Resend (RESEND_API_KEY) : expéditeur noreply@sama-stock.com (domaine vérifié chez Resend), réponses vers LEGAL.email.
 * - Gmail en secours (SMTP_USER / SMTP_PASS, « mot de passe d'application » Google) : sans clé Resend,
 *   ou si Resend refuse l'envoi.
 */
const resendKey = cleanSecret(process.env.RESEND_API_KEY);
const isSmtpEnabled = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
export const isMailEnabled = Boolean(resendKey) || isSmtpEnabled;

type MailMessage = { to: string; subject: string; text: string; html: string };

async function sendWithResend(message: MailMessage) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Sama Stock <noreply@${MAIN_DOMAIN}>`, reply_to: LEGAL.email, ...message, to: [message.to] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend a refusé l'e-mail (${res.status}) : ${(await res.text()).slice(0, 200)}`);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    // Google affiche le mot de passe d'application en 4 groupes : les espaces sont retirés
    auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s+/g, "") },
  });
  return transporter;
}

export async function sendMail(message: MailMessage) {
  if (!isMailEnabled) throw new Error("Envoi d'e-mails non configuré (RESEND_API_KEY ou SMTP_USER / SMTP_PASS).");
  if (resendKey) {
    try {
      return await sendWithResend(message);
    } catch (error) {
      if (!isSmtpEnabled) throw error;
      console.error("[mail] Resend en échec, envoi par Gmail :", error);
    }
  }
  await getTransporter().sendMail({
    from: { name: "Sama Stock", address: process.env.SMTP_USER! },
    ...message,
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** E-mail de réinitialisation du mot de passe : simple, lisible sur téléphone, un seul bouton. */
export function resetPasswordEmail(input: { name: string; url: string }) {
  const first = input.name.split(" ")[0] || "Bonjour";
  const text = [
    `Bonjour ${first},`,
    "",
    "Vous avez demandé à changer le mot de passe de votre compte Sama Stock.",
    `Ouvrez ce lien pour en choisir un nouveau (valable 1 heure) : ${input.url}`,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe ne change pas.",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f8f5;font-family:Arial,Helvetica,sans-serif;color:#0b1310">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e8e5;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#0b6e4f">Sama Stock</p>
<p style="margin:0 0 12px;font-size:16px">Bonjour ${escapeHtml(first)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Vous avez demandé à changer le mot de passe de votre compte. Touchez le bouton pour en choisir un nouveau. Le lien est valable <strong>1 heure</strong>.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0b6e4f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Choisir un nouveau mot de passe</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#58635e">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe ne change pas.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: "Changer votre mot de passe", text, html };
}

/** E-mail d'alerte pour l'équipe Sama Stock (panne, sauvegarde ratée) : le message et un bouton vers l'admin. */
export function alertEmail(input: { title: string; body: string; url: string }) {
  const text = [input.body, "", `Voir : ${input.url}`].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f8f5;font-family:Arial,Helvetica,sans-serif;color:#0b1310">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e8e5;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#b42318">${escapeHtml(input.title)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(input.body)}</p>
<p style="margin:0"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0b6e4f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Ouvrir l'administration</a></p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: input.title, text, html };
}
