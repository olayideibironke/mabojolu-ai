import {
  isValidSRI,
  prebuiltAppConfig,
  type AppConfig,
  type ModelIntegrity,
  type ModelRecord,
} from "@mlc-ai/web-llm";

import {
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
} from "./browser-device-profile";

export const MABOJOLU_ARTIFACT_SCHEMA_VERSION =
  1 as const;

export const MABOJOLU_WEBLLM_VERSION =
  "0.2.85" as const;

export const MABOJOLU_BROWSER_MODEL_IDS = [
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
] as const;

export type MabojoluBrowserModelId =
  (
    typeof MABOJOLU_BROWSER_MODEL_IDS
  )[number];

export interface MabojoluArtifactModel {
  modelId:
    MabojoluBrowserModelId;

  modelUrl:
    string;

  modelLibUrl:
    string;

  integrity: {
    config:
      string;

    modelLib:
      string;

    tokenizer?:
      Record<
        string,
        string
      >;
  };
}

export interface MabojoluArtifactManifest {
  schemaVersion:
    typeof MABOJOLU_ARTIFACT_SCHEMA_VERSION;

  releaseId:
    string;

  webLlmVersion:
    typeof MABOJOLU_WEBLLM_VERSION;

  models:
    MabojoluArtifactModel[];
}

export interface MabojoluArtifactSource {
  id:
    string;

  kind:
    "mabojolu-mirror" |
    "webllm-upstream";

  appConfig:
    AppConfig;
}

export interface MabojoluArtifactResolution {
  sources:
    MabojoluArtifactSource[];

  mirrorStatus:
    | "not-configured"
    | "ready"
    | "unreachable"
    | "invalid";

  warning?:
    string;
}

export interface ArtifactFetchResponse {
  ok:
    boolean;

  json():
    Promise<unknown>;
}

export type ArtifactFetch =
  (
    input:
      string,
  ) =>
    Promise<
      ArtifactFetchResponse
    >;

const RELEASE_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function isRecord(
  value:
    unknown,
): value is
  Record<
    string,
    unknown
  > {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function isAllowedModelId(
  value:
    unknown,
): value is
  MabojoluBrowserModelId {
  return (
    typeof value ===
      "string" &&
    (
      value ===
        BROWSER_MODEL_1B ||
      value ===
        BROWSER_MODEL_3B
    )
  );
}

function isSafeArtifactUrl(
  value:
    unknown,
): value is
  string {
  if (
    typeof value !==
      "string" ||
    value.trim()
      .length ===
      0
  ) {
    return false;
  }

  try {
    const url =
      new URL(
        value,
      );

    if (
      url.protocol ===
      "https:"
    ) {
      return true;
    }

    return (
      url.protocol ===
        "http:" &&
      (
        url.hostname ===
          "localhost" ||
        url.hostname ===
          "127.0.0.1" ||
        url.hostname ===
          "::1"
      )
    );
  } catch {
    return false;
  }
}

function validIntegrityMap(
  value:
    unknown,
):
  value is
    Record<
      string,
      string
    > {
  if (
    !isRecord(
      value,
    )
  ) {
    return false;
  }

  return Object.entries(
    value,
  ).every(
    ([
      filename,
      sri,
    ]) =>
      filename.trim()
        .length >
        0 &&
      typeof sri ===
        "string" &&
      isValidSRI(
        sri,
      ),
  );
}

function parseModel(
  value:
    unknown,
):
  MabojoluArtifactModel |
  undefined {
  if (
    !isRecord(
      value,
    ) ||
    !isAllowedModelId(
      value.modelId,
    ) ||
    !isSafeArtifactUrl(
      value.modelUrl,
    ) ||
    !isSafeArtifactUrl(
      value.modelLibUrl,
    ) ||
    !isRecord(
      value.integrity,
    ) ||
    typeof value
      .integrity
      .config !==
      "string" ||
    !isValidSRI(
      value
        .integrity
        .config,
    ) ||
    typeof value
      .integrity
      .modelLib !==
      "string" ||
    !isValidSRI(
      value
        .integrity
        .modelLib,
    )
  ) {
    return undefined;
  }

  const tokenizer =
    value
      .integrity
      .tokenizer;

  if (
    tokenizer !==
      undefined &&
    !validIntegrityMap(
      tokenizer,
    )
  ) {
    return undefined;
  }

  return {
    modelId:
      value.modelId,

    modelUrl:
      value.modelUrl,

    modelLibUrl:
      value.modelLibUrl,

    integrity: {
      config:
        value
          .integrity
          .config,

      modelLib:
        value
          .integrity
          .modelLib,

      ...(tokenizer
        ? {
            tokenizer: {
              ...tokenizer,
            },
          }
        : {}),
    },
  };
}

export function parseMabojoluArtifactManifest(
  value:
    unknown,
):
  MabojoluArtifactManifest |
  undefined {
  if (
    !isRecord(
      value,
    ) ||
    value.schemaVersion !==
      MABOJOLU_ARTIFACT_SCHEMA_VERSION ||
    value.webLlmVersion !==
      MABOJOLU_WEBLLM_VERSION ||
    typeof value.releaseId !==
      "string" ||
    !RELEASE_ID_PATTERN.test(
      value.releaseId,
    ) ||
    !Array.isArray(
      value.models,
    ) ||
    value.models.length ===
      0
  ) {
    return undefined;
  }

  const models =
    value.models.map(
      parseModel,
    );

  if (
    models.some(
      (model) =>
        !model,
    )
  ) {
    return undefined;
  }

  const parsed =
    models as
      MabojoluArtifactModel[];

  const ids =
    parsed.map(
      (model) =>
        model.modelId,
    );

  if (
    new Set(
      ids,
    ).size !==
    ids.length
  ) {
    return undefined;
  }

  return {
    schemaVersion:
      MABOJOLU_ARTIFACT_SCHEMA_VERSION,

    releaseId:
      value.releaseId,

    webLlmVersion:
      MABOJOLU_WEBLLM_VERSION,

    models:
      parsed.map(
        (model) => ({
          ...model,

          integrity: {
            ...model.integrity,

            ...(model
                .integrity
                .tokenizer
              ? {
                  tokenizer: {
                    ...model
                      .integrity
                      .tokenizer,
                  },
                }
              : {}),
          },
        }),
      ),
  };
}

function selectedUpstreamRecords():
  ModelRecord[] {
  return MABOJOLU_BROWSER_MODEL_IDS
    .map(
      (modelId) => {
        const record =
          prebuiltAppConfig
            .model_list
            .find(
              (candidate) =>
                candidate
                  .model_id ===
                modelId,
            );

        if (
          !record
        ) {
          throw new Error(
            "The pinned WebLLM runtime no longer contains every Mabojolu browser model.",
          );
        }

        return {
          ...record,

          ...(record
              .overrides
            ? {
                overrides: {
                  ...record
                    .overrides,
                },
              }
            : {}),
        };
      },
    );
}

export function upstreamMabojoluAppConfig():
  AppConfig {
  return {
    cacheBackend:
      prebuiltAppConfig
        .cacheBackend ??
      "cache",

    model_list:
      selectedUpstreamRecords(),
  };
}

export function buildMabojoluMirrorAppConfig(
  manifest:
    MabojoluArtifactManifest,
):
  AppConfig {
  const upstream =
    selectedUpstreamRecords();

  const byId =
    new Map(
      manifest.models.map(
        (model) => [
          model.modelId,
          model,
        ],
      ),
    );

  const mirrored =
    upstream
      .filter(
        (record) =>
          byId.has(
            record.model_id as
              MabojoluBrowserModelId,
          ),
      )
      .map(
        (record) => {
          const artifact =
            byId.get(
              record.model_id as
                MabojoluBrowserModelId,
            );

          if (
            !artifact
          ) {
            throw new Error(
              "Artifact manifest lookup failed.",
            );
          }

          const integrity:
            ModelIntegrity = {
            config:
              artifact
                .integrity
                .config,

            model_lib:
              artifact
                .integrity
                .modelLib,

            ...(artifact
                .integrity
                .tokenizer
              ? {
                  tokenizer: {
                    ...artifact
                      .integrity
                      .tokenizer,
                  },
                }
              : {}),

            onFailure:
              "error",
          };

          return {
            ...record,

            model:
              artifact
                .modelUrl,

            model_lib:
              artifact
                .modelLibUrl,

            integrity,
          };
        },
      );

  if (
    mirrored.length ===
      0
  ) {
    throw new Error(
      "Artifact manifest does not contain a supported Mabojolu browser model.",
    );
  }

  return {
    cacheBackend:
      "cache",

    model_list:
      mirrored,
  };
}

function upstreamSource():
  MabojoluArtifactSource {
  return {
    id:
      "webllm-upstream-" +
      MABOJOLU_WEBLLM_VERSION,

    kind:
      "webllm-upstream",

    appConfig:
      upstreamMabojoluAppConfig(),
  };
}

export async function resolveMabojoluArtifactSources(
  manifestUrl:
    string |
    null |
    undefined,

  fetchArtifact:
    ArtifactFetch =
      async (
        input,
      ) =>
        fetch(
          input,
          {
            cache:
              "no-store",
          },
        ),
):
  Promise<
    MabojoluArtifactResolution
  > {
  const upstream =
    upstreamSource();

  if (
    !manifestUrl
  ) {
    return {
      sources: [
        upstream,
      ],

      mirrorStatus:
        "not-configured",
    };
  }

  if (
    !isSafeArtifactUrl(
      manifestUrl,
    )
  ) {
    return {
      sources: [
        upstream,
      ],

      mirrorStatus:
        "invalid",

      warning:
        "The Mabojolu artifact manifest URL is not an allowed HTTPS or localhost URL.",
    };
  }

  try {
    const response =
      await fetchArtifact(
        manifestUrl,
      );

    if (
      !response.ok
    ) {
      return {
        sources: [
          upstream,
        ],

        mirrorStatus:
          "unreachable",

        warning:
          "The Mabojolu artifact manifest could not be fetched; using the compatible upstream source.",
      };
    }

    const manifest =
      parseMabojoluArtifactManifest(
        await response.json(),
      );

    if (
      !manifest
    ) {
      return {
        sources: [
          upstream,
        ],

        mirrorStatus:
          "invalid",

        warning:
          "The Mabojolu artifact manifest failed version, URL, or integrity validation; using the compatible upstream source.",
      };
    }

    return {
      sources: [
        {
          id:
            "mabojolu-" +
            manifest.releaseId,

          kind:
            "mabojolu-mirror",

          appConfig:
            buildMabojoluMirrorAppConfig(
              manifest,
            ),
        },

        upstream,
      ],

      mirrorStatus:
        "ready",
    };
  } catch {
    return {
      sources: [
        upstream,
      ],

      mirrorStatus:
        "unreachable",

      warning:
        "The Mabojolu artifact manifest could not be loaded; using the compatible upstream source.",
    };
  }
}
