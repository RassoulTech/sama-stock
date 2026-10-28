"use client";

import { PushDevicePanel } from "@/components/notifications/push-device-panel";
import { removeAdminPushSubscription, saveAdminPushSubscription, sendAdminTestAlert } from "@/server/actions/admin-alerts";

/** « Alertes sur ce téléphone » : l'administrateur est prévenu des pannes, même application fermée. */
export function AdminAlertSettings({ publicKey }: { publicKey: string | null }) {
  return (
    <PushDevicePanel
      publicKey={publicKey}
      title="Alertes sur ce téléphone"
      pitch="Le téléphone sonne quand Sama Stock a un problème, même écran éteint. Un e-mail part aussi sur l'adresse de l'équipe."
      missingKeys="Les clés de notification ne sont pas encore configurées : seules les alertes par e-mail fonctionnent."
      enabledToast="Alertes activées sur ce téléphone"
      save={saveAdminPushSubscription}
      remove={removeAdminPushSubscription}
      test={sendAdminTestAlert}
    />
  );
}
