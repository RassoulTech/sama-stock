"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Événement d'installation de Chrome, Edge et Samsung Internet (Android, Windows). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// L'événement arrive une seule fois, tôt : on l'écoute dès le chargement du module
let deferred: InstallEvent | null = null;
let installed = false;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

type Mode = "hidden" | "prompt" | "ios" | "manual";

function useInstallMode(): Mode {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => -1,
  );
  const [platform, setPlatform] = useState<"unknown" | "standalone" | "ios" | "touch" | "desktop">("unknown");
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'appareil n'est connu que dans le navigateur
    setPlatform(standalone ? "standalone" : ios ? "ios" : touch ? "touch" : "desktop");
  }, []);

  if (platform === "unknown" || platform === "standalone" || installed) return "hidden";
  if (deferred) return "prompt";
  if (platform === "ios") return "ios";
  // Téléphone Android sans l'événement (Firefox, ou déjà proposé) : on explique le menu du navigateur
  return platform === "touch" ? "manual" : "hidden";
}

/** Installation de l'application : `mode` dit si c'est possible, `dialog` est à placer dans la page. */
export function useInstall(appName: string) {
  const mode = useInstallMode();
  const [help, setHelp] = useState(false);

  async function install() {
    if (mode === "prompt" && deferred) {
      const event = deferred;
      await event.prompt();
      const choice = await event.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        deferred = null;
        notify();
      }
      return;
    }
    setHelp(true);
  }

  const dialog = <InstallHelp open={help} onOpenChange={setHelp} appName={appName} ios={mode === "ios"} />;
  return { mode, install, dialog };
}

/** Bouton « Installer l'application » : invisible quand elle est déjà installée ou que le navigateur ne sait pas l'installer. */
export function InstallAppButton({
  appName,
  label = "Installer l'application",
  variant = "outline",
  size,
  className,
}: {
  appName: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const { mode, install, dialog } = useInstall(appName);
  if (mode === "hidden") return null;
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => void install()}>
        <Download /> {label}
      </Button>
      {dialog}
    </>
  );
}

/** Encart d'installation (page de connexion de la boutique, appareil qui vient d'être activé). */
export function InstallAppBanner({ appName, iconUrl, className }: { appName: string; iconUrl?: string; className?: string }) {
  const { mode, install, dialog } = useInstall(appName);
  if (mode === "hidden") return null;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm", className)}>
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- icône générée par le serveur
        <img src={iconUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Installer l&apos;application</p>
        <p className="text-xs text-muted-foreground">
          {appName} sur l&apos;écran d&apos;accueil : elle s&apos;ouvre directement sur cette page.
        </p>
      </div>
      <Button type="button" size="sm" onClick={() => void install()}>
        Installer
      </Button>
      {dialog}
    </div>
  );
}

function InstallHelp({ open, onOpenChange, appName, ios }: { open: boolean; onOpenChange: (open: boolean) => void; appName: string; ios: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Installer {appName}</DialogTitle>
          <DialogDescription>Deux gestes, une seule fois. L&apos;icône apparaît ensuite sur l&apos;écran d&apos;accueil.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          {ios ? (
            <>
              <li className="flex items-start gap-3">
                <Share className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  Touchez le bouton <strong>Partager</strong> de Safari (le carré avec une flèche vers le haut).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <SquarePlus className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>, puis <strong>Ajouter</strong>.
                </span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-3">
                <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">1</span>
                <span>
                  Ouvrez le menu du navigateur (<strong>⋮</strong> en haut à droite).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">2</span>
                <span>
                  Touchez <strong>Installer l&apos;application</strong> ou <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
                </span>
              </li>
            </>
          )}
        </ol>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            C&apos;est compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
