import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Inline secrets at build time — Tauri doesn't populate process.env at runtime
  env: {
    CLAWDESK_LICENSE_SECRET: process.env.CLAWDESK_LICENSE_SECRET ?? "dev-only",
  },
  serverExternalPackages: ["better-sqlite3", "ws"],
  devIndicators: false,
  outputFileTracingIncludes: {
    "**": [
      "./node_modules/styled-jsx/**",
      "./node_modules/@swc/helpers/**",
      "./node_modules/@next/env/**",
      "./node_modules/bindings/**",
      "./node_modules/file-uri-to-path/**",
    ],
  },
};

export default nextConfig;
