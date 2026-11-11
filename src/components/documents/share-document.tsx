"use client";

import { Check, Download, FileText, Loader2, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { waLink } from "@/lib/whatsapp";

/**
 * « Envoyer le PDF » : sur téléphone, le fichier part directement (WhatsApp, Telegram…).
 * Sur ordinateur, WhatsApp ne peut pas recevoir un fichier par un lien : on télécharge le PDF, on ouvre la
 * discussion avec le message, et on explique comment y glisser le fichier.
 */
export function ShareDocumentButton({
  pdfUrl,
  verifyUrl,
  fileName,
  phone,
  message,
  label = "Envoyer le PDF",
  size = "lg",
  className,
  assistant = false,
}: {
  pdfUrl: string;
  verifyUrl: string;
  fileName: string;
  phone: string | null | undefined;
  message: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** L'assistant vocal peut envoyer ce document (une seule page de document à la fois). */
  assistant?: boolean;
}) {
  const fileRef = useRef<File | null>(null);
  const [pending, setPending] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [desktopDone, setDesktopDone] = useState(false);
  const share = { pdfUrl, verifyUrl, fileName, phone, message };

  // L'assistant appelle l'envoi depuis le toucher du commerçant sur sa bulle (le téléphone l'exige pour un fichier)
  usePiloteEcran(
    "document",
    {
      envoyer: async () => {
        if (!isPhone()) {
          const opened = downloadAndOpenWhatsApp(share);
          setDesktopDone(true);
          setDesktopOpen(true);
          return opened
            ? { ok: true, message: "WhatsApp est ouvert et le PDF est téléchargé : il reste à glisser le fichier dans la discussion." }
            : { ok: false, message: "Le navigateur a bloqué WhatsApp : autorise les fenêtres pour ce site." };
        }
        if (canShare()) {
          const file = fileRef.current ?? (await loadFile(pdfUrl, fileName));
          if (file && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], text: message });
              return { ok: true, message: "Le PDF est parti par le partage du téléphone." };
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") return { ok: false, message: "Envoi annulé." };
            }
          }
        }
        return openTab(waLink(phone, `${message}\n\n${verifyUrl}`))
          ? { ok: true, message: "WhatsApp est ouvert avec le message et le lien du document." }
          : { ok: false, message: "Le navigateur a bloqué WhatsApp : autorise les fenêtres pour ce site." };
      },
    },
    assistant,
  );

  // Sur téléphone, le PDF est préparé à l'avance : le partage doit partir tout de suite après le toucher
  useEffect(() => {
    if (!isPhone() || !canShare()) return;
    const timer = setTimeout(() => void loadFile(pdfUrl, fileName).then((f) => (fileRef.current = f)), 600);
    return () => clearTimeout(timer);
  }, [pdfUrl, fileName]);

  async function send() {
    if (!isPhone()) return setDesktopOpen(true);
    if (canShare()) {
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
    // Téléphone sans partage de fichier : le message et le lien du document
    if (!openTab(waLink(phone, `${message}\n\n${verifyUrl}`))) toast.error("Autorisez l'ouverture de WhatsApp dans votre navigateur.");
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={send}
        disabled={pending}
        data-assistant={assistant ? "document.envoyer" : undefined}
        className={className ?? "w-full bg-[#25D366] text-[#0b1310] hover:bg-[#1fb857]"}>
        {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />} {label}
      </Button>
      <DesktopShareDialog open={desktopOpen} onOpenChange={setDesktopOpen} done={desktopDone} onDone={setDesktopDone} {...share} />
    </>
  );
}

function DesktopShareDialog({
  open,
  onOpenChange,
  done,
  onDone,
  pdfUrl,
  verifyUrl,
  fileName,
  phone,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Le PDF est téléchargé et WhatsApp ouvert : il reste la dernière étape. */
  done: boolean;
  onDone: (done: boolean) => void;
  pdfUrl: string;
  verifyUrl: string;
  fileName: string;
  phone: string | null | undefined;
  message: string;
}) {
  const [sharing, setSharing] = useState(false);
  const [systemShare, setSystemShare] = useState(false);
  const fileRef = useRef<File | null>(null);

  // Windows (Chrome, Edge) sait partager un fichier vers WhatsApp pour Windows : on prépare le PDF à l'ouverture
  useEffect(() => {
    if (!open || !canShare()) return;
    let alive = true;
    void loadFile(pdfUrl, fileName).then((f) => {
      if (!alive || !f) return;
      fileRef.current = f;
      setSystemShare(navigator.canShare({ files: [f] }));
    });
    return () => {
      alive = false;
    };
  }, [open, pdfUrl, fileName]);

  function downloadAndOpen() {
    if (!downloadAndOpenWhatsApp({ pdfUrl, verifyUrl, fileName, phone, message })) toast.error("Autorisez l'ouverture de WhatsApp dans votre navigateur.");
    onDone(true);
  }

  async function shareWithApp() {
    const file = fileRef.current;
    if (!file) return;
    setSharing(true);
    try {
      await navigator.share({ files: [file], text: message });
      onOpenChange(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Partage impossible : utilisez le bouton vert.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) onDone(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer le PDF sur WhatsApp</DialogTitle>
          <DialogDescription>
            Sur ordinateur, WhatsApp ne peut pas recevoir le fichier tout seul. Un clic télécharge le PDF et ouvre la
            discussion ; il reste à y glisser le fichier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{fileName}</span>
            <span className="block text-xs text-muted-foreground">{phone ? `Pour le ${phone}` : "Vous choisirez le contact dans WhatsApp"}</span>
          </span>
        </div>

        {done ? (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-accent p-4 text-sm text-accent-foreground">
            <p className="flex items-center gap-2 font-semibold">
              <Check className="size-4" /> Dernière étape dans WhatsApp
            </p>
            <p>
              Glissez le fichier <strong>{fileName}</strong> dans la discussion (il est dans vos Téléchargements, ou en haut à
              droite du navigateur). Vous pouvez aussi cliquer sur <strong>+</strong> (ou le trombone), puis <strong>Document</strong>.
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>1. Le PDF se télécharge sur l&apos;ordinateur.</li>
            <li>2. WhatsApp s&apos;ouvre avec le message et le lien du document.</li>
            <li>3. Vous glissez le PDF dans la discussion.</li>
          </ol>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" size="lg" onClick={downloadAndOpen} className="w-full bg-[#25D366] text-[#0b1310] hover:bg-[#1fb857]">
            {done ? <Download /> : <MessageCircle />} {done ? "Télécharger et ouvrir à nouveau" : "Télécharger le PDF et ouvrir WhatsApp"}
          </Button>
          {systemShare && (
            <Button type="button" variant="outline" onClick={shareWithApp} disabled={sharing} className="w-full">
              {sharing ? <Loader2 className="animate-spin" /> : <Share2 />} Partager avec WhatsApp pour Windows
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/**
 * Ouvre un onglet et dit s'il s'est ouvert. (Avec « noopener », le navigateur rend toujours null : on coupe le lien
 * vers cette page après coup.)
 */
function openTab(url: string): boolean {
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  tab.opener = null;
  return true;
}

/** Sur ordinateur : la discussion WhatsApp avec le message, et le PDF téléchargé à côté. */
function downloadAndOpenWhatsApp(d: { pdfUrl: string; verifyUrl: string; fileName: string; phone: string | null | undefined; message: string }): boolean {
  // WhatsApp d'abord, dans le même geste : sinon le navigateur bloque la nouvelle fenêtre
  const opened = openTab(waLink(d.phone, `${d.message}\n\n${d.verifyUrl}`));
  const a = document.createElement("a");
  a.href = `${d.pdfUrl}?telecharger=1`;
  a.download = d.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return opened;
}

/** Téléphone ou tablette : la fenêtre de partage du système propose WhatsApp avec le fichier. */
function isPhone(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function";
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
