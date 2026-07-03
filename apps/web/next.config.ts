import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages du workspace sont livrés en sources TS : Next les transpile.
  transpilePackages: ["@a4a/ui", "@a4a/db", "@a4a/payments", "@a4a/ai"],
  // Image Docker minimale (server.js autonome + traces de dépendances).
  // Conditionnel : la sortie standalone crée des symlinks, interdits sans
  // privilèges sous Windows — activée uniquement dans le build Docker (Linux).
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),
};

export default nextConfig;
