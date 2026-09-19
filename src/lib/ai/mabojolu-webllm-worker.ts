import {
  CreateMLCEngine,
  type MLCEngineInterface,
} from "@mlc-ai/web-llm";

interface GenerateMessage {
  type:
    "generate";

  requestId:
    string;

  modelCandidates:
    string[];

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

let loadedModelId:
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

async function ensureEngine(
  modelId:
    string,

  requestId:
    string,
):
  Promise<void> {
  if (
    engine &&
    loadedModelId ===
      modelId
  ) {
    return;
  }

  if (
    engine
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

  post({
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

  loadedModelId =
    modelId;
}

async function generate(
  message:
    GenerateMessage,
):
  Promise<void> {
  const {
    requestId,
    modelCandidates,
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

  let lastError:
    unknown = null;

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
        post({
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
        engine
      ) {
        try {
          await engine
            .unload();
        } catch {
          // The next ensureEngine call will replace the stale engine.
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
