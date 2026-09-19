export interface BrowserComputeCapabilities {
  webGpu: boolean;

  webAssembly: boolean;

  eligible: boolean;

  reasons:
    string[];
}

export interface BrowserComputeProbe {
  webGpu?:
    boolean;

  webAssembly?:
    boolean;
}

export interface BrowserInferenceMessage {
  role:
    | "system"
    | "user"
    | "assistant";

  content: string;
}

export interface BrowserInferenceRequest {
  messages:
    BrowserInferenceMessage[];

  maxOutputTokens:
    number;

  signal:
    AbortSignal;
}

export type BrowserInferenceChunk =
  | {
      type: "text";

      text: string;
    }
  | {
      type: "finish";

      finishReason:
        | "end_turn"
        | "max_tokens"
        | "aborted";
    };

export interface BrowserInferenceEngine {
  readonly id: string;

  load():
    Promise<void>;

  stream(
    request:
      BrowserInferenceRequest,
  ):
    AsyncIterable<
      BrowserInferenceChunk
    >;
}

interface WebLlmDelta {
  content?: string;
}

interface WebLlmChoice {
  delta?:
    WebLlmDelta;

  finish_reason?:
    string |
    null;
}

interface WebLlmChunk {
  choices?:
    WebLlmChoice[];
}

interface WebLlmCompletionApi {
  create(input: {
    messages:
      BrowserInferenceMessage[];

    stream: true;

    max_tokens:
      number;
  }):
    | AsyncIterable<
        WebLlmChunk
      >
    | Promise<
        AsyncIterable<
          WebLlmChunk
        >
      >;
}

interface WebLlmEngine {
  chat: {
    completions:
      WebLlmCompletionApi;
  };
}

export interface WebLlmModule {
  CreateMLCEngine(
    modelId:
      string,

    config?: {
      initProgressCallback?:
        (
          progress:
            unknown,
        ) => void;
    },
  ):
    Promise<
      WebLlmEngine
    >;
}

export type WebLlmModuleLoader =
  () =>
    Promise<
      WebLlmModule
    >;

/**
 * Detect whether a browser has the minimum primitives needed for WebGPU local
 * model execution.
 *
 * Tests can inject an explicit probe; production callers can omit it and use
 * the browser's real globals.
 */
export function detectBrowserComputeCapabilities(
  probe:
    BrowserComputeProbe =
      {},
):
  BrowserComputeCapabilities {
  const detectedWebGpu =
    probe.webGpu ??
    (
      typeof navigator !==
        "undefined" &&
      "gpu" in navigator
    );

  const detectedWebAssembly =
    probe.webAssembly ??
    (
      typeof WebAssembly !==
      "undefined"
    );

  const reasons:
    string[] = [];

  if (
    !detectedWebGpu
  ) {
    reasons.push(
      "WebGPU is unavailable.",
    );
  }

  if (
    !detectedWebAssembly
  ) {
    reasons.push(
      "WebAssembly is unavailable.",
    );
  }

  return {
    webGpu:
      detectedWebGpu,

    webAssembly:
      detectedWebAssembly,

    eligible:
      detectedWebGpu &&
      detectedWebAssembly,

    reasons,
  };
}

/**
 * Browser-local WebLLM adapter contract.
 *
 * The WebLLM package itself is intentionally injected through a loader. This
 * keeps Mabojolu's cognitive and routing layers independent of one browser
 * inference library while still matching WebLLM's current CreateMLCEngine and
 * OpenAI-style streaming chat API.
 */
export class WebLlmBrowserInferenceEngine
  implements BrowserInferenceEngine
{
  readonly id:
    string;

  private engine:
    WebLlmEngine |
    undefined;

  private loading:
    Promise<void> |
    undefined;

  constructor(
    private readonly modelId:
      string,

    private readonly loadModule:
      WebLlmModuleLoader,

    private readonly onLoadProgress?:
      (
        progress:
          unknown,
      ) => void,
  ) {
    this.id =
      "browser-webgpu:" +
      modelId;
  }

  async load():
    Promise<void> {
    if (
      this.engine
    ) {
      return;
    }

    if (
      this.loading
    ) {
      return this.loading;
    }

    this.loading =
      this.loadOnce();

    try {
      await this.loading;
    } finally {
      this.loading =
        undefined;
    }
  }

  async *stream(
    request:
      BrowserInferenceRequest,
  ):
    AsyncIterable<
      BrowserInferenceChunk
    > {
    if (
      request.signal
        .aborted
    ) {
      yield {
        type: "finish",
        finishReason:
          "aborted",
      };

      return;
    }

    await this.load();

    const engine =
      this.engine;

    if (
      !engine
    ) {
      throw new Error(
        "Browser inference engine failed to load.",
      );
    }

    const completion =
      await engine
        .chat
        .completions
        .create({
          messages:
            request.messages,

          stream: true,

          max_tokens:
            request
              .maxOutputTokens,
        });

    let finishReason:
      | "end_turn"
      | "max_tokens" =
        "end_turn";

    for await (
      const chunk of
        completion
    ) {
      if (
        request.signal
          .aborted
      ) {
        yield {
          type: "finish",
          finishReason:
            "aborted",
        };

        return;
      }

      const choice =
        chunk.choices?.[0];

      const text =
        choice
          ?.delta
          ?.content;

      if (
        text
      ) {
        yield {
          type: "text",
          text,
        };
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

    yield {
      type: "finish",
      finishReason,
    };
  }

  private async loadOnce():
    Promise<void> {
    const webLlmModule =
      await this.loadModule();

    this.engine =
      await webLlmModule
        .CreateMLCEngine(
          this.modelId,
          {
            ...(this.onLoadProgress
              ? {
                  initProgressCallback:
                    this.onLoadProgress,
                }
              : {}),
          },
        );
  }
}
