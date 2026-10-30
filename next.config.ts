import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@node-rs/argon2", "embedded-postgres", "pg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization, Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
