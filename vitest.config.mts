import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// ESM has no __dirname; derive it from this module URL.
const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test configuration.
 *
 * Two projects, because the suites have genuinely different needs: server-side
 * logic runs fastest in a plain Node environment, while component tests need a
 * DOM. Running everything under jsdom would slow the logic tests and let a
 * browser-only global mask a server bug.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias from tsconfig.json.
      "@": path.resolve(dirname, "./src"),
      /*
       * `server-only` is a marker package resolved by the Next bundler, which
       * Vitest does not run. Aliasing it to an empty module lets server modules
       * be unit tested; the real client-import guard still applies in
       * `next build`, where it matters.
       */
      "server-only": path.resolve(dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.test.ts"],
          // Component tests live in .test.tsx and belong to the other project.
          exclude: ["src/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
