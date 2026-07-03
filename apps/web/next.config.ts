import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages du workspace sont livrés en sources TS : Next les transpile.
  transpilePackages: ["@a4a/ui", "@a4a/db", "@a4a/payments", "@a4a/ai"],
};

export default nextConfig;
