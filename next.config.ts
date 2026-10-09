import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  async redirects() {
    return [
      { source: "/onboarding", destination: "/businesses/new", permanent: false },
      { source: "/onboarding/status/:jobId", destination: "/businesses", permanent: false },
      { source: "/assessments", destination: "/businesses", permanent: false },
      { source: "/reports", destination: "/businesses", permanent: false },
      ...["dashboard", "sources", "locations", "map", "suppliers", "alerts", "resilience", "feasibility", "costing", "stress", "admin"].flatMap((section) => [
        { source: `/${section}`, destination: "/businesses", permanent: false },
        { source: `/${section}/:path*`, destination: "/businesses", permanent: false },
      ]),
    ];
  },
  experimental: {
    serverActions: {
      // 10 MB document uploads plus multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
