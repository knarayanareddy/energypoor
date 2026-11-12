import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview is proxied from a *.e2b.app host; without this Next dev
  // rejects cross-origin requests for the HMR endpoints.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost:3000", "127.0.0.1:3000"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
