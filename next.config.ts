import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@google-cloud/vertexai",
    "google-auth-library",
  ],
};

export default nextConfig;
