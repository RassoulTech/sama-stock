"use client";

import { Download, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { waLink } from "@/lib/whatsapp";

/**
 * « Envoyer le PDF » : sur téléphone, le fichier part directement (WhatsApp, Telegram…) ;
 * sur ordinateur, WhatsApp s'ouvre avec le message et le lien du document.
 */
export function ShareDocumentButton({
  pdfUrl,
  verifyUrl,
  fileName,
  phone,
  message,
  label = "Envoyer le PDF",
  className,
}: {
  pdfUrl: string;
  verifyUrl: string;
  fileName: string;
  phone: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  const fileRef = useRef<File | null>(null);
  const [pending, setPending] = useState(false);

  // Sur téléphone, le PDF est préparé à l'avance : le partage doit partir tout de suite après le toucher
  useEffect(() => {
    if (!canShareFiles()) return;
    const timer = setTimeout(() => void loadFile(pdfUrl, fileName).then((f) => (fileRef.current = f)), 600);
    return () => clearTimeout(timer);
  }, [pdfUrl, fileName]);

  async function send() {
    const text = `${message}\n\n${verifyUrl}`;
    if (canShareFiles()) {
      setPending(true);
      try {
        const file = fileRef.current ?? (await loadFile(pdfUrl, fileName));
        if (file && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: message });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        setPending(false);
      }
    }
    const opened = window.open(waLink(phone, text), "_blank", "noopener,noreferrer");
    if (!opened) toast.error("Autorisez l'ouverture de WhatsApp dans votre navigateur.");
  }

  return (
    <Button type="button" size="lg" onClick={send} disabled={pending} className={className ?? "w-full bg-[#25D366] text-white hover:bg-[#1fb857]"}>
      {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />} {label}
    </Button>
  );
}

export function DownloadPdfButton({ pdfUrl, label = "Télécharger le PDF" }: { pdfUrl: string; label?: string }) {
  return (
    <Button asChild variant="outline">
      <a href={`${pdfUrl}?telecharger=1`}>
        <Download /> {label}
      </a>
    </Button>
  );
}

function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    // Sur ordinateur, la fenêtre de partage du système n'aide pas : WhatsApp Web avec le lien est plus simple
    window.matchMedia("(pointer: coarse)").matches
  );
}

async function loadFile(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new File([await res.blob()], name, { type: "application/pdf" });
  } catch {
    return null;
  }
}
