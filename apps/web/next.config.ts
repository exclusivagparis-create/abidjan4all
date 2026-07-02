import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages du workspace sont livrés en sources TS : Next les transpile.
  transpilePackages: ["@a4a/ui", "@a4a/db"],
};

export default nextConfig;
