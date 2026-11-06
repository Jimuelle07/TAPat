import type { NextConfig } from "next";

// docs/api-and-data.md §7.3: API_ORIGIN is required; the build fails without it.
// Copy apps/web/.env.example to apps/web/.env.local.
const apiOrigin = process.env.API_ORIGIN;
if (!apiOrigin) {
  throw new Error("API_ORIGIN is not set: copy apps/web/.env.example to apps/web/.env.local");
}
const apiUrl = new URL(apiOrigin); // throws on a malformed value

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@tapat/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Chain calls (enroll, settlement, sweep) can outlast Next's 30 s rewrite-proxy default; Caddy has no such limit in prod.
  experimental: { proxyTimeout: 120_000 },
  // The browser only ever calls /api/*; Next forwards it to the API (local dev; Caddy routes it in prod).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl.origin}/api/:path*` }];
  },
};

export default nextConfig;
