"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { shopAppUrl } from "@/lib/domains";
import { waLink } from "@/lib/whatsapp";

/** Message d'accès envoyé au client sur WhatsApp. */
export function accessMessage(input: { ownerName: string; businessName: string; url: string; email: string; password: string | null }) {
  const first = input.ownerName.split(" ")[0];
  return [
    `Bonjour ${first},`,
    `Bienvenue dans votre application *${input.businessName}* (Sama Stock) !`,
    "",
    `Connexion : ${input.url}`,
    `E-mail : ${input.email}`,
    input.password ? `Mot de passe provisoire : ${input.password}` : "Mot de passe : celui de votre compte habituel.",
    "",
    "Astuce : sur votre téléphone, ouvrez le lien puis « Ajouter à l'écran d'accueil » pour avoir l'icône de votre application.",
    input.password ? "Vous pourrez choisir votre propre mot de passe dans Paramètres." : "",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

/**
 * Accès du client après l'installation : identifiants à copier, envoi WhatsApp en un geste,
 * et QR code à scanner avec son téléphone (ouvre la connexion avec son e-mail déjà rempli).
 */
export function AccessShare({
  ownerName,
  businessName,
  email,
  password,
  phone,
  slug = null,
}: {
  ownerName: string;
  businessName: string;
  email: string;
  password: string | null;
  phone: string | null;
  /** Adresse de la page de connexion de la boutique ; à défaut, la connexion de Sama Stock. */
  slug?: string | null;
}) {
  // Affiché seulement après une action dans le navigateur : l'adresse du site est connue tout de suite
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Boutique sous licence : son adresse à elle (nom.sama-stock.com) ; sinon la connexion de Sama Stock
  const appUrl = origin && slug ? shopAppUrl(origin, slug) : null;
  const url = origin ? `${appUrl ?? `${origin}/connexion`}?email=${encodeURIComponent(email)}` : "";

  useEffect(() => {
    if (!url) return;
    let alive = true;
    void import("qrcode").then((QR) =>
      QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1310", light: "#ffffff" } }).then((svg) => {
        if (alive) setQr(svg);
      }),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Copie impossible (navigateur ancien) : la valeur reste lisible à l'écran
    }
  }

  const message = url ? accessMessage({ ownerName, businessName, url, email, password }) : "";

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-3">
        {[
          ...(appUrl ? [{ label: "Adresse de son application", value: appUrl }] : []),
          { label: "E-mail", value: email },
          ...(password ? [{ label: "Mot de passe provisoire", value: password }] : []),
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">{f.label}</span>
              <span className="block truncate font-mono text-sm font-semibold">{f.value}</span>
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copy(f.label, f.value)} aria-label={`Copier ${f.label}`}>
              {copied === f.label ? <Check className="text-primary" /> : <Copy />}
            </Button>
          </div>
        ))}
        {!password && <p className="text-xs text-muted-foreground">Ce client avait déjà un compte : il garde son mot de passe (ou sa connexion Google).</p>}
        <div className="flex flex-wrap gap-2">
          {phone && message && (
            <Button asChild>
              <a href={waLink(phone, message)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Envoyer sur WhatsApp
              </a>
            </Button>
          )}
          {message && (
            <Button type="button" variant="outline" onClick={() => void copy("message", message)}>
              {copied === "message" ? <Check className="text-primary" /> : <Copy />} Copier le message
            </Button>
          )}
        </div>
      </div>
      <figure className="mx-auto flex w-40 flex-col items-center gap-1.5 sm:mx-0">
        <div className="size-40 overflow-hidden rounded-xl border bg-white p-1" aria-label="QR code de connexion" dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
        <figcaption className="text-center text-xs text-muted-foreground">À scanner avec le téléphone du client pour ouvrir son application</figcaption>
      </figure>
    </div>
  );
}
