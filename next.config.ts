import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Pin the workspace root.
   *
   * A stray package-lock.json in a parent directory (OneDrive\Documents here)
   * otherwise makes Next infer the wrong root and warn on every build. Pinning it
   * also keeps file tracing scoped to this project.
   */
  outputFileTracingRoot: path.join(__dirname),

  // Fail the build on a type error rather than shipping past one. This is the
  // default; stated explicitly so nobody disables it casually.
  //
  // Note there is no `eslint` key here: Next.js 16 removed it, because `next
  // build` no longer runs ESLint. Linting is a separate step, wired into the
  // `verify` script so it still gates every change.
  typescript: { ignoreBuildErrors: false },

  // Do not advertise the framework version to every visitor.
  poweredByHeader: false,

  async headers() {
    return [
      {
        /*
         * Static asset headers.
         *
         * proxy.ts deliberately skips these paths, so their headers are set here.
         * Assets are content-hashed and immutable, hence the long cache.
         */
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Never cache an API response: every one is user-specific.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
