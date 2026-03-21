import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "ws"],
  devIndicators: false,
};

export default nextConfig;
