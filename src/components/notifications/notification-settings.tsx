"use client";

import { Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TOPICS, type NotifyPrefs, type NotifyTopic } from "@/lib/domain/notifications";
import { playSound, type SoundKind } from "@/lib/sounds";
import { removePushSubscription, savePushSubscription, sendTestNotification, updateNotifyPrefs } from "@/server/actions/notifications";
import { PushDevicePanel } from "./push-device-panel";

const SOUNDS: [SoundKind, string][] = [
  ["sale", "Vente"],
  ["order", "Commande"],
  ["stock", "Stock"],
];

export function NotificationSettings({ publicKey, prefs: initial }: { publicKey: string | null; prefs: NotifyPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  async function save(next: NotifyPrefs) {
    const before = prefs;
    setPrefs(next);
    const res = await updateNotifyPrefs(next);
    if (!res.ok) {
      setPrefs(before);
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-5">
      <PushDevicePanel
        publicKey={publicKey}
        title="Sur ce téléphone, même application fermée"
        pitch="Le téléphone sonne et vibre comme pour un message, même écran éteint."
        missingKeys="Bientôt disponible. En attendant, la cloche en haut de l'écran vous prévient tant que l'application est ouverte."
        enabledToast="Notifications activées sur ce téléphone"
        save={savePushSubscription}
        remove={removePushSubscription}
        test={sendTestNotification}
      />

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
