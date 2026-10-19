import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverActions: {
    // Les photos produits compressées transitent par les Server Actions
    bodySizeLimit: "2mb",
  },
};

export default nextConfig;
