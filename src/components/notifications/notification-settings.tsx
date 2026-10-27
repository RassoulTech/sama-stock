"use client";

import { BellRing, CheckCircle2, Loader2, Smartphone, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TOPICS, type NotifyPrefs, type NotifyTopic } from "@/lib/domain/notifications";
import { playSound, unlockSound, type SoundKind } from "@/lib/sounds";
import { removePushSubscription, savePushSubscription, sendTestNotification, updateNotifyPrefs } from "@/server/actions/notifications";

/** État des notifications « application fermée » sur ce téléphone. */
type DeviceState = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

function detect(): DeviceState {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // Sur iPhone, les notifications ne marchent que dans l'application installée sur l'écran d'accueil
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return "loading";
}

const SOUNDS: [SoundKind, string][] = [
  ["sale", "Vente"],
  ["order", "Commande"],
  ["stock", "Stock"],
];

export function NotificationSettings({ publicKey, prefs: initial }: { publicKey: string | null; prefs: NotifyPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [device, setDevice] = useState<DeviceState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Le navigateur n'est connu qu'une fois la page affichée
    void Promise.resolve()
      .then(async () => {
        const state = detect();
        if (state !== "loading") return state;
        const sub = await (await registration()).pushManager.getSubscription();
        return sub ? "on" : "off";
      })
      .catch((): DeviceState => "off")
      .then(setDevice);
  }, []);

  async function save(next: NotifyPrefs) {
    const before = prefs;
    setPrefs(next);
    const res = await updateNotifyPrefs(next);
    if (!res.ok) {
      setPrefs(before);
      toast.error(res.error);
    }
  }

  async function enable() {
    if (!publicKey) return;
    unlockSound();
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "blocked" : "off");
        toast.error("Autorisez les notifications pour être prévenu.");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) }));
      const json = sub.toJSON();
      const res = await savePushSubscription({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDevice("on");
      toast.success("Notifications activées sur ce téléphone");
      void sendTestNotification();
    } catch {
      toast.error("Ce téléphone n'a pas pu s'abonner. Réessayez avec internet.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setDevice("off");
      toast.success("Ce téléphone ne recevra plus les notifications");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await sendTestNotification();
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else if (res.data.sent === 0) toast.error("Aucun téléphone n'a reçu l'essai : désactivez puis réactivez les notifications.");
    else toast.success("Essai envoyé : la notification arrive dans quelques secondes");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-primary" /> Sur ce téléphone, même application fermée
        </p>
        {!publicKey ? (
          <p className="text-sm text-muted-foreground">Bientôt disponible. En attendant, la cloche en haut de l&apos;écran vous prévient tant que l&apos;application est ouverte.</p>
        ) : device === "loading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : device === "ios-install" ? (
          <p className="text-sm text-muted-foreground">
            Sur iPhone, installez d&apos;abord l&apos;application : bouton Partager, puis « Sur l&apos;écran d&apos;accueil ». Ouvrez-la depuis son icône et revenez ici.
          </p>
        ) : device === "unsupported" ? (
          <p className="text-sm text-muted-foreground">Ce navigateur ne sait pas recevoir de notifications. Essayez avec Chrome.</p>
        ) : device === "blocked" ? (
          <p className="text-sm text-muted-foreground">
            Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (cadenas à côté de l&apos;adresse), puis rechargez la page.
          </p>
        ) : device === "on" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Activées : ce téléphone sonne à chaque notification.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void test()}>
                <BellRing /> Envoyer un essai
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void disable()}>
                Désactiver sur ce téléphone
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Le téléphone sonne et vibre comme pour un message, même écran éteint.</p>
            <Button disabled={busy} onClick={() => void enable()}>
              {busy ? <Loader2 className="animate-spin" /> : <BellRing />} Activer sur ce téléphone
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Me prévenir pour</p>
        {(Object.entries(TOPICS) as [NotifyTopic, (typeof TOPICS)[NotifyTopic]][]).map(([key, t]) => (
          <label key={key} htmlFor={`notify-${key}`} className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
            <Switch id={`notify-${key}`} checked={prefs[key]} onCheckedChange={(v) => void save({ ...prefs, [key]: v })} />
          </label>
        ))}
        <label htmlFor="notify-sound" className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Son dans l&apos;application</span>
            <span className="block text-xs text-muted-foreground">Quand l&apos;application est ouverte (sinon, c&apos;est le son du téléphone)</span>
          </span>
          <Switch id="notify-sound" checked={prefs.sound} onCheckedChange={(v) => void save({ ...prefs, sound: v })} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Volume2 className="size-4" /> Écouter :
        </span>
        {SOUNDS.map(([kind, label]) => (
          <Button key={kind} type="button" variant="outline" size="sm" onClick={() => playSound(kind)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
