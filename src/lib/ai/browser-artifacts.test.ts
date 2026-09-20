import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BROWSER_MODEL_FAST,
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
} from "./browser-device-profile";

import {
  MABOJOLU_ARTIFACT_SCHEMA_VERSION,
  MABOJOLU_WEBLLM_VERSION,
  buildMabojoluMirrorAppConfig,
  parseMabojoluArtifactManifest,
  resolveMabojoluArtifactSources,
} from "./browser-artifacts";

const VALID_SRI =
  "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function manifest() {
  return {
    schemaVersion:
      MABOJOLU_ARTIFACT_SCHEMA_VERSION,

    releaseId:
      "2026.09.19-r1",

    webLlmVersion:
      MABOJOLU_WEBLLM_VERSION,

    models: [
      {
        modelId:
          BROWSER_MODEL_FAST,

        modelUrl:
          "https://models.example.test/qwen-fast",

        modelLibUrl:
          "https://models.example.test/libs/qwen-fast.wasm",

        integrity: {
          config:
            VALID_SRI,

          modelLib:
            VALID_SRI,
        },
      },

      {
        modelId:
          BROWSER_MODEL_1B,

        modelUrl:
          "https://models.example.test/llama-1b",

        modelLibUrl:
          "https://models.example.test/libs/llama-1b.wasm",

        integrity: {
          config:
            VALID_SRI,

          modelLib:
            VALID_SRI,

          tokenizer: {
            "tokenizer.json":
              VALID_SRI,
          },
        },
      },

      {
        modelId:
          BROWSER_MODEL_3B,

        modelUrl:
          "https://models.example.test/llama-3b",

        modelLibUrl:
          "https://models.example.test/libs/llama-3b.wasm",

        integrity: {
          config:
            VALID_SRI,

          modelLib:
            VALID_SRI,
        },
      },
    ],
  };
}

describe(
  "Mabojolu browser model artifact registry",
  () => {
    it(
      "accepts a version-compatible integrity-anchored manifest",
      () => {
        const parsed =
          parseMabojoluArtifactManifest(
            manifest(),
          );

        expect(
          parsed,
        ).toBeDefined();

        expect(
          parsed
            ?.releaseId,
        ).toBe(
          "2026.09.19-r1",
        );

        expect(
          parsed
            ?.models,
        ).toHaveLength(3);
      },
    );

    it(
      "rejects an incompatible WebLLM version or schema version",
      () => {
        expect(
          parseMabojoluArtifactManifest({
            ...manifest(),

            webLlmVersion:
              "0.2.84",
          }),
        ).toBeUndefined();

        expect(
          parseMabojoluArtifactManifest({
            ...manifest(),

            schemaVersion:
              2,
          }),
        ).toBeUndefined();
      },
    );

    it(
      "rejects malformed integrity metadata and insecure non-local artifact URLs",
      () => {
        const invalidHash =
          manifest();

        invalidHash.models[0]
          .integrity
          .config =
          "sha256-not-a-valid-hash";

        expect(
          parseMabojoluArtifactManifest(
            invalidHash,
          ),
        ).toBeUndefined();

        const insecure =
          manifest();

        insecure.models[0]
          .modelUrl =
          "http://models.example.test/llama-1b";

        expect(
          parseMabojoluArtifactManifest(
            insecure,
          ),
        ).toBeUndefined();
      },
    );

    it(
      "builds a WebLLM app config that points at Mabojolu-controlled artifacts and fails closed on integrity errors",
      () => {
        const parsed =
          parseMabojoluArtifactManifest(
            manifest(),
          );

        expect(
          parsed,
        ).toBeDefined();

        if (
          !parsed
        ) {
          return;
        }

        const appConfig =
          buildMabojoluMirrorAppConfig(
            parsed,
          );

        const fast =
          appConfig
            .model_list
            .find(
              (record) =>
                record
                  .model_id ===
                BROWSER_MODEL_FAST,
            );

        expect(
          fast?.model,
        ).toBe(
          "https://models.example.test/qwen-fast",
        );

        const oneB =
          appConfig
            .model_list
            .find(
              (record) =>
                record
                  .model_id ===
                BROWSER_MODEL_1B,
            );

        expect(
          oneB?.model,
        ).toBe(
          "https://models.example.test/llama-1b",
        );

        expect(
          oneB
            ?.model_lib,
        ).toBe(
          "https://models.example.test/libs/llama-1b.wasm",
        );

        expect(
          oneB
            ?.integrity,
        ).toMatchObject({
          config:
            VALID_SRI,

          model_lib:
            VALID_SRI,

          onFailure:
            "error",
        });
      },
    );

    it(
      "uses the Mabojolu mirror first and keeps upstream as transition fallback",
      async () => {
        const result =
          await resolveMabojoluArtifactSources(
            "https://models.example.test/manifest.json",

            async () => ({
              ok: true,

              json:
                async () =>
                  manifest(),
            }),
          );

        expect(
          result.mirrorStatus,
        ).toBe(
          "ready",
        );

        expect(
          result.sources
            .map(
              (source) =>
                source.kind,
            ),
        ).toEqual([
          "mabojolu-mirror",
          "webllm-upstream",
        ]);
      },
    );

    it(
      "falls back to upstream when the mirror manifest is unreachable or invalid",
      async () => {
        const unreachable =
          await resolveMabojoluArtifactSources(
            "https://models.example.test/manifest.json",

            async () => ({
              ok: false,

              json:
                async () => ({}),
            }),
          );

        expect(
          unreachable
            .sources
            .map(
              (source) =>
                source.kind,
            ),
        ).toEqual([
          "webllm-upstream",
        ]);

        expect(
          unreachable
            .mirrorStatus,
        ).toBe(
          "unreachable",
        );

        const invalid =
          await resolveMabojoluArtifactSources(
            "https://models.example.test/manifest.json",

            async () => ({
              ok: true,

              json:
                async () => ({
                  nope:
                    true,
                }),
            }),
          );

        expect(
          invalid
            .sources
            .map(
              (source) =>
                source.kind,
            ),
        ).toEqual([
          "webllm-upstream",
        ]);

        expect(
          invalid
            .mirrorStatus,
        ).toBe(
          "invalid",
        );
      },
    );

    it(
      "runs upstream-only when no Mabojolu mirror is configured",
      async () => {
        const result =
          await resolveMabojoluArtifactSources(
            undefined,
          );

        expect(
          result
            .mirrorStatus,
        ).toBe(
          "not-configured",
        );

        expect(
          result
            .sources,
        ).toHaveLength(1);

        expect(
          result
            .sources[0]
            ?.kind,
        ).toBe(
          "webllm-upstream",
        );
      },
    );
  },
);
