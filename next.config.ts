import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
