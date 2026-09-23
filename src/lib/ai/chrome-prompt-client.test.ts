import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  latestChromePrompt,
  startChromePromptSession,
} from "./chrome-prompt-client";

afterEach(
  () => {
    Reflect.deleteProperty(
      window,
      "LanguageModel",
    );

    vi.restoreAllMocks();
  },
);

describe(
  "Chrome Prompt API adapter",
  () => {
    it(
      "uses the latest user turn as the prompt",
      () => {
        expect(
          latestChromePrompt([
            {
              role:
                "system",
              content:
                "system",
            },
            {
              role:
                "user",
              content:
                "first",
            },
            {
              role:
                "assistant",
              content:
                "answer",
            },
            {
              role:
                "user",
              content:
                "latest",
            },
          ]),
        ).toBe(
          "latest",
        );
      },
    );

    it(
      "returns null when no user turn exists",
      () => {
        expect(
          latestChromePrompt([
            {
              role:
                "system",
              content:
                "system",
            },
          ]),
        ).toBeNull();
      },
    );

    it(
      "declares text and image input for a multimodal session",
      async () => {
        const create =
          vi.fn(
            async (
              _options: unknown,
            ) => ({
              promptStreaming:
                vi.fn(),
            }),
          );

        Reflect.set(
          window,
          "LanguageModel",
          {
            create,
          },
        );

        const controller =
          new AbortController();

        const session =
          await startChromePromptSession(
            [
              {
                role:
                  "system",
                content:
                  "system",
              },
              {
                role:
                  "user",
                content:
                  "Analyze this image.",
              },
            ],
            controller.signal,
            undefined,
            [
              "text",
              "image",
            ],
          );

        expect(
          session,
        ).not.toBeNull();

        expect(
          create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          create.mock.calls[
            0
          ]?.[
            0
          ],
        ).toMatchObject({
          expectedInputs: [
            {
              type:
                "text",
              languages: [
                "en",
              ],
            },
            {
              type:
                "image",
            },
          ],

          expectedOutputs: [
            {
              type:
                "text",
              languages: [
                "en",
              ],
            },
          ],
        });
      },
    );
  },
);
