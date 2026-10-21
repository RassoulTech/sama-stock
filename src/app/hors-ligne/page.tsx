import type { Metadata } from "next";
import { OfflineApp } from "@/components/offline/offline-app";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Caisse hors ligne", robots: NO_INDEX };

/**
 * Page statique, sans donnée serveur : le service worker la garde pour l'ouvrir sans internet. Les données viennent
 * du téléphone (copie de la caisse et ventes en attente).
 */
export default function HorsLignePage() {
  return <OfflineApp />;
}
