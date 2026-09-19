import {
  CreateMLCEngine,
} from "https://esm.run/@mlc-ai/web-llm@0.2.85";

let engine =
  null;

let loadedModelId =
  null;

let activeRequestId =
  null;

async function ensureEngine(
  modelId,
  requestId,
) {
  if (
    engine &&
    loadedModelId ===
      modelId
  ) {
    return;
  }

  if (
    engine &&
    typeof engine.unload ===
      "function"
  ) {
    try {
      await engine.unload();
    } catch {
      // A stale engine can still be replaced below.
    }
  }

  engine =
    null;

  loadedModelId =
    null;

  self.postMessage({
    type:
      "status",

    requestId,

    label:
      "Preparing on-device model...",
  });

  engine =
    await CreateMLCEngine(
      modelId,
      {
        initProgressCallback:
          (progress) => {
            const label =
              typeof progress?.text ===
                "string" &&
              progress.text
                .trim()
                .length >
                0
                ? progress.text
                : "Loading on-device model...";

            self.postMessage({
              type:
                "status",

              requestId,

              label,
            });
          },
      },
    );

  loadedModelId =
    modelId;
}

async function generate(
  message,
) {
  const {
    requestId,
    modelId,
    messages,
    maxOutputTokens,
  } = message;

  activeRequestId =
    requestId;

  try {
    await ensureEngine(
      modelId,
      requestId,
    );

    if (
      activeRequestId !==
      requestId
    ) {
      return;
    }

    self.postMessage({
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

    let finishReason =
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
        self.postMessage({
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

      self.postMessage({
        type:
          "done",

        requestId,

        finishReason,
      });
    }
  } catch (
    cause
  ) {
    if (
      activeRequestId ===
      requestId
    ) {
      activeRequestId =
        null;
    }

    self.postMessage({
      type:
        "error",

      requestId,

      message:
        cause instanceof
          Error
          ? cause.message
          : "On-device inference failed.",
    });
  }
}

self.addEventListener(
  "message",
  (
    event,
  ) => {
    const message =
      event.data;

    if (
      !message ||
      typeof message !==
        "object"
    ) {
      return;
    }

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
          ?.interruptGenerate?.();
      } catch {
        // The iterator will still be ignored because the request id was cleared.
      }

      self.postMessage({
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
