import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const ROOT =
  process.cwd();

function read(
  path:
    string,
): string {
  return readFileSync(
    join(
      ROOT,
      path,
    ),
    "utf8",
  );
}

describe(
  "Mabojolu bundled browser runtime independence",
  () => {
    it(
      "pins WebLLM in the application dependency graph",
      () => {
        const packageJson =
          JSON.parse(
            read(
              "package.json",
            ),
          ) as {
            dependencies?: Record<
              string,
              string
            >;
          };

        expect(
          packageJson
            .dependencies?.[
              "@mlc-ai/web-llm"
            ],
        ).toBe(
          "0.2.85",
        );
      },
    );

    it(
      "bundles the WebLLM worker from application source instead of a remote CDN URL",
      () => {
        const client =
          read(
            "src/lib/ai/browser-chat-client.ts",
          );

        const worker =
          read(
            "src/lib/ai/mabojolu-webllm-worker.ts",
          );

        expect(
          client,
        ).toMatch(
          /new URL\(\s*"\.\/mabojolu-webllm-worker\.ts",\s*import\.meta\.url,/,
        );

        expect(
          worker,
        ).toContain(
          'from "@mlc-ai/web-llm"',
        );

        expect(
          worker,
        ).not.toMatch(
          /https?:\/\//,
        );

        expect(
          client,
        ).not.toMatch(
          /esm\.run|jsdelivr|unpkg/,
        );
      },
    );

    it(
      "routes browser model delivery through the Mabojolu artifact control plane",
      () => {
        const client =
          read(
            "src/lib/ai/browser-chat-client.ts",
          );

        const worker =
          read(
            "src/lib/ai/mabojolu-webllm-worker.ts",
          );

        const registry =
          read(
            "src/lib/ai/browser-artifacts.ts",
          );

        expect(
          client,
        ).toContain(
          "NEXT_PUBLIC_MABOJOLU_ARTIFACT_MANIFEST_URL",
        );

        expect(
          worker,
        ).toContain(
          "resolveMabojoluArtifactSources",
        );

        expect(
          registry,
        ).toContain(
          "MABOJOLU_ARTIFACT_SCHEMA_VERSION",
        );

        expect(
          registry,
        ).toContain(
          'onFailure:\n              "error"',
        );
      },
    );

    it(
      "removes the legacy public worker that imported WebLLM from esm.run",
      () => {
        expect(
          existsSync(
            join(
              ROOT,
              "public/workers/mabojolu-webllm-worker.js",
            ),
          ),
        ).toBe(false);
      },
    );
  },
);
