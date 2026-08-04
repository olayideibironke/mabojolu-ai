import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Pin the workspace root so Next.js does not mistake a parent folder's
   * package-lock.json for this application's root.
   */
  outputFileTracingRoot: path.join(__dirname),

  /*
   * Never allow a production build to continue past TypeScript errors.
   */
  typescript: {
    ignoreBuildErrors: false,
  },

  /*
   * Do not expose the framework version through the X-Powered-By header.
   */
  poweredByHeader: false,

  async headers() {
    return [
      {
        /*
         * Next.js manages caching for its own content-hashed static assets.
         * We add only the content-type protection header here.
         */
        source: "/_next/static/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        /*
         * API responses contain user-specific data and must never be cached.
         */
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;