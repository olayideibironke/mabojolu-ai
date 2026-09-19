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
    modelCandidates,
    messages,
    maxOutputTokens,
  } = message;

  activeRequestId =
    requestId;

  const candidates =
    Array.isArray(
      modelCandidates,
    )
      ? modelCandidates
          .filter(
            (candidate) =>
              typeof candidate ===
                "string" &&
              candidate.length >
                0,
          )
      : [];

  if (
    candidates.length ===
      0
  ) {
    self.postMessage({
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

  let lastError =
    null;

  for (
    let index = 0;
    index <
      candidates.length;
    index +=
      1
  ) {
    const modelId =
      candidates[index];

    let emittedText =
      false;

    try {
      if (
        index >
        0
      ) {
        self.postMessage({
          type:
            "status",

          requestId,

          label:
            "Switching to a lighter on-device model...",
        });
      }

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
          emittedText =
            true;

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

          modelId,
        });
      }

      return;
    } catch (
      cause
    ) {
      lastError =
        cause;

      /*
       * Never restart with a second model after visible text has already been
       * emitted. Doing so would splice two answers together.
       */
      if (
        emittedText
      ) {
        break;
      }

      if (
        engine &&
        typeof engine.unload ===
          "function"
      ) {
        try {
          await engine.unload();
        } catch {
          // The next ensureEngine call will still replace the stale engine.
        }
      }

      engine =
        null;

      loadedModelId =
        null;
    }
  }

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
      lastError instanceof
        Error
        ? lastError.message
        : "On-device inference failed.",
  });
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
