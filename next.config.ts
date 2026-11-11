import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No servidor, o deploy automático builda em duas pastas que se alternam
  // (.next-a / .next-b) para o app atual seguir no ar durante o build.
  // Ver deploy/windows/LEIA-ME.md. Fora dele, segue o padrão .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
