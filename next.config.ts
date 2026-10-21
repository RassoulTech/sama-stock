import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Génération des fichiers Excel mis en forme (rapports, modèle d'import)
  serverExternalPackages: ["exceljs"],
  // Version de l'application : le service worker remet en cache la caisse hors ligne quand elle change
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}` },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Les photos produits compressées transitent par les Server Actions
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
