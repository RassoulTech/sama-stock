import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Génération des fichiers Excel mis en forme (rapports, modèle d'import)
  serverExternalPackages: ["exceljs"],
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
