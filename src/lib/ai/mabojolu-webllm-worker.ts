import {
  CreateMLCEngine,
  type MLCEngineInterface,
} from "@mlc-ai/web-llm";

import {
  resolveMabojoluArtifactSources,
  type MabojoluArtifactSource,
} from "./browser-artifacts";

interface GenerateMessage {
  type:
    "generate";

  requestId:
    string;

  modelCandidates:
    string[];

  artifactManifestUrl?:
    string |
    null;

  messages:
    Array<{
      role:
        "system" |
        "user" |
        "assistant";

      content:
        string;
    }>;

  maxOutputTokens:
    number;
}

interface AbortMessage {
  type:
    "abort";

  requestId:
    string;
}

type IncomingMessage =
  | GenerateMessage
  | AbortMessage;

let engine:
  MLCEngineInterface |
  null = null;

let loadedEngineKey:
  string |
  null = null;

let activeRequestId:
  string |
  null = null;

function post(
  message:
    Record<
      string,
      unknown
    >,
):
  void {
  self.postMessage(
    message,
  );
}

async function unloadEngine():
  Promise<void> {
  if (
    engine
  ) {
    try {
      await engine
        .unload();
    } catch {
      // A stale engine can still be replaced below.
    }
  }

  engine =
    null;

  loadedEngineKey =
    null;
}

async function ensureEngine(
  modelId:
    string,

  source:
    MabojoluArtifactSource,

  requestId:
    string,
):
  Promise<void> {
  const engineKey =
    source.id +
    "::" +
    modelId;

  if (
    engine &&
    loadedEngineKey ===
      engineKey
  ) {
    return;
  }

  await unloadEngine();

  post({
    type:
      "status",

    requestId,

    label:
      source.kind ===
        "mabojolu-mirror"
        ? "Preparing Mabojolu model artifacts..."
        : "Preparing compatible upstream model artifacts...",
  });

  engine =
    await CreateMLCEngine(
      modelId,
      {
        appConfig:
          source.appConfig,

        initProgressCallback:
          (
            progress,
          ) => {
            const label =
              typeof progress
                .text ===
                "string" &&
              progress
                .text
                .trim()
                .length >
                0
                ? progress
                    .text
                : "Loading on-device model...";

            post({
              type:
                "status",

              requestId,

              label,
            });
          },
      },
    );

  loadedEngineKey =
    engineKey;
}

async function generate(
  message:
    GenerateMessage,
):
  Promise<void> {
  const {
    requestId,
    modelCandidates,
    artifactManifestUrl,
    messages,
    maxOutputTokens,
  } = message;

  activeRequestId =
    requestId;

  const candidates =
    modelCandidates
      .filter(
        (candidate) =>
          candidate.length >
          0,
      );

  if (
    candidates.length ===
      0
  ) {
    post({
      type:
        "error",

      requestId,

      message:
        "No compatible on-device model is available.",
    });

    activeRequestId =
      null;

    return;
  }

  const artifactResolution =
    await resolveMabojoluArtifactSources(
      artifactManifestUrl,
    );

  if (
    artifactResolution.warning
  ) {
    post({
      type:
        "status",

      requestId,

      label:
        artifactResolution
          .warning,
    });
  }

  let lastError:
    unknown = null;

  for (
    let modelIndex = 0;
    modelIndex <
      candidates.length;
    modelIndex +=
      1
  ) {
    const modelId =
      candidates[
        modelIndex
      ];

    if (
      modelIndex >
      0
    ) {
      post({
        type:
          "status",

        requestId,

        label:
          "Switching to a lighter on-device model...",
      });
    }

    for (
      let sourceIndex = 0;
      sourceIndex <
        artifactResolution
          .sources
          .length;
      sourceIndex +=
        1
    ) {
      const source =
        artifactResolution
          .sources[
            sourceIndex
          ];

      let emittedText =
        false;

      try {
        if (
          sourceIndex >
            0
        ) {
          post({
            type:
              "status",

            requestId,

            label:
              "Mabojolu artifact delivery was unavailable; switching to the compatible upstream artifact source.",
          });
        }

        await ensureEngine(
          modelId,
          source,
          requestId,
        );

        if (
          activeRequestId !==
          requestId ||
          !engine
        ) {
          return;
        }

        post({
          type:
            "status",

          requestId,

          label:
            "Thinking on this device...",
        });

        const stream =
          await engine
            .chat
            .completions
            .create({
              messages,

              stream:
                true,

              max_tokens:
                maxOutputTokens,

              temperature:
                0.7,
            });

        let finishReason:
          "end_turn" |
          "max_tokens" =
            "end_turn";

        for await (
          const chunk of
            stream
        ) {
          if (
            activeRequestId !==
            requestId
          ) {
            return;
          }

          const choice =
            chunk
              .choices?.[0];

          const text =
            choice
              ?.delta
              ?.content ??
            "";

          if (
            text
          ) {
            emittedText =
              true;

            post({
              type:
                "delta",

              requestId,

              text,
            });
          }

          if (
            choice
              ?.finish_reason ===
            "length"
          ) {
            finishReason =
              "max_tokens";
          }
        }

        if (
          activeRequestId ===
          requestId
        ) {
          activeRequestId =
            null;

          post({
            type:
              "done",

            requestId,

            finishReason,

            modelId,

            artifactSource:
              source.kind,

            artifactSourceId:
              source.id,
          });
        }

        return;
      } catch (
        cause
      ) {
        lastError =
          cause;

        /*
         * Never restart with another artifact source or model after visible
         * text has already been emitted. Doing so would splice answers.
         */
        if (
          emittedText
        ) {
          modelIndex =
            candidates.length;

          break;
        }

        await unloadEngine();
      }
    }
  }

  if (
    activeRequestId ===
    requestId
  ) {
    activeRequestId =
      null;
  }

  post({
    type:
      "error",

    requestId,

    message:
      lastError instanceof
        Error
        ? lastError.message
        : "On-device inference failed.",
  });
}

self.addEventListener(
  "message",
  (
    event:
      MessageEvent<
        IncomingMessage
      >,
  ) => {
    const message =
      event.data;

    if (
      message.type ===
      "generate"
    ) {
      void generate(
        message,
      );

      return;
    }

    if (
      message.type ===
        "abort" &&
      activeRequestId ===
        message.requestId
    ) {
      activeRequestId =
        null;

      try {
        engine
          ?.interruptGenerate();
      } catch {
        // The iterator is still ignored because the request id was cleared.
      }

      post({
        type:
          "done",

        requestId:
          message.requestId,

        finishReason:
          "aborted",
      });
    }
  },
);
