import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  detectBrowserComputeCapabilities,
  WebLlmBrowserInferenceEngine,
  type WebLlmModule,
} from "./browser-compute";

describe(
  "Mabojolu browser-owned compute",
  () => {
    it(
      "requires both WebGPU and WebAssembly for browser-local inference",
      () => {
        expect(
          detectBrowserComputeCapabilities({
            webGpu:
              true,

            webAssembly:
              true,
          }),
        ).toMatchObject({
          webGpu:
            true,

          webAssembly:
            true,

          eligible:
            true,

          reasons: [],
        });

        expect(
          detectBrowserComputeCapabilities({
            webGpu:
              false,

            webAssembly:
              true,
          }),
        ).toMatchObject({
          eligible:
            false,

          reasons: [
            "WebGPU is unavailable.",
          ],
        });
      },
    );

    it(
      "loads the injected WebLLM runtime once and streams browser-generated text",
      async () => {
        const create =
          vi.fn(
            async () => ({
              chat: {
                completions: {
                  create:
                    async () => ({
                      async *[
                        Symbol
                          .asyncIterator
                      ]() {
                        yield {
                          choices: [
                            {
                              delta: {
                                content:
                                  "Hello ",
                              },
                            },
                          ],
                        };

                        yield {
                          choices: [
                            {
                              delta: {
                                content:
                                  "from browser",
                              },
                            },
                          ],
                        };
                      },
                    }),
                },
              },
            }),
          );

        const webLlmModule:
          WebLlmModule = {
          CreateMLCEngine:
            create,
        };

        const engine =
          new WebLlmBrowserInferenceEngine(
            "local-model",
            async () =>
              webLlmModule,
          );

        const chunks = [];

        for await (
          const chunk of
            engine.stream({
              messages: [
                {
                  role:
                    "user",

                  content:
                    "Hello",
                },
              ],

              maxOutputTokens:
                64,

              signal:
                new AbortController()
                  .signal,
            })
        ) {
          chunks.push(
            chunk,
          );
        }

        await engine.load();

        expect(
          create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          chunks,
        ).toEqual([
          {
            type: "text",
            text:
              "Hello ",
          },
          {
            type: "text",
            text:
              "from browser",
          },
          {
            type: "finish",
            finishReason:
              "end_turn",
          },
        ]);
      },
    );

    it(
      "maps a browser model length stop to Mabojolu max_tokens",
      async () => {
        const engine =
          new WebLlmBrowserInferenceEngine(
            "local-model",
            async () => ({
              CreateMLCEngine:
                async () => ({
                  chat: {
                    completions: {
                      create:
                        async () => ({
                          async *[
                            Symbol
                              .asyncIterator
                          ]() {
                            yield {
                              choices: [
                                {
                                  delta: {
                                    content:
                                      "partial",
                                  },

                                  finish_reason:
                                    "length",
                                },
                              ],
                            };
                          },
                        }),
                    },
                  },
                }),
            }),
          );

        const chunks = [];

        for await (
          const chunk of
            engine.stream({
              messages: [
                {
                  role:
                    "user",

                  content:
                    "Continue",
                },
              ],

              maxOutputTokens:
                1,

              signal:
                new AbortController()
                  .signal,
            })
        ) {
          chunks.push(
            chunk,
          );
        }

        expect(
          chunks.at(-1),
        ).toEqual({
          type: "finish",
          finishReason:
            "max_tokens",
        });
      },
    );

    it(
      "honors cancellation before browser model loading begins",
      async () => {
        const create =
          vi.fn();

        const controller =
          new AbortController();

        controller.abort();

        const engine =
          new WebLlmBrowserInferenceEngine(
            "local-model",
            async () => ({
              CreateMLCEngine:
                create,
            } as unknown as WebLlmModule),
          );

        const chunks = [];

        for await (
          const chunk of
            engine.stream({
              messages: [],

              maxOutputTokens:
                64,

              signal:
                controller.signal,
            })
        ) {
          chunks.push(
            chunk,
          );
        }

        expect(
          create,
        ).not.toHaveBeenCalled();

        expect(
          chunks,
        ).toEqual([
          {
            type: "finish",
            finishReason:
              "aborted",
          },
        ]);
      },
    );
  },
);
