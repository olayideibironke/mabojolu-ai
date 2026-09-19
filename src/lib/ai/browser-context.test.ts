import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BROWSER_CONTEXT_WINDOW_TOKENS,
  buildBrowserContext,
} from "./browser-context";

function message(
  id:
    string,

  role:
    "user" |
    "assistant",

  content:
    string,
) {
  return {
    id,
    role,
    content,
    createdAt:
      "2026-09-19T20:00:00.000Z",
  };
}

describe(
  "Mabojolu bounded browser context",
  () => {
    it(
      "keeps the current user request intact",
      () => {
        const result =
          buildBrowserContext({
            systemPrompt:
              "You are Mabojolu.",

            messages: [
              message(
                "u1",
                "user",
                "Earlier question",
              ),

              message(
                "a1",
                "assistant",
                "Earlier answer",
              ),

              message(
                "u2",
                "user",
                "Current request must remain unchanged.",
              ),
            ],

            maxOutputTokens:
              1024,
          });

        expect(
          result.fits,
        ).toBe(true);

        expect(
          result
            .messages
            .at(-1),
        ).toEqual({
          role:
            "user",

          content:
            "Current request must remain unchanged.",
        });
      },
    );

    it(
      "drops older history instead of exceeding the browser context window",
      () => {
        const veryLong =
          "history ".repeat(
            1600,
          );

        const result =
          buildBrowserContext({
            systemPrompt:
              "You are Mabojolu.",

            messages: [
              message(
                "u1",
                "user",
                veryLong,
              ),

              message(
                "a1",
                "assistant",
                veryLong,
              ),

              message(
                "u2",
                "user",
                "What matters now?",
              ),
            ],

            maxOutputTokens:
              1024,
          });

        expect(
          result.fits,
        ).toBe(true);

        expect(
          result
            .omittedMessageCount,
        ).toBeGreaterThan(0);

        expect(
          result
            .estimatedInputTokens +
            1024,
        ).toBeLessThan(
          BROWSER_CONTEXT_WINDOW_TOKENS,
        );
      },
    );

    it(
      "does not keep an assistant reply when its paired user turn no longer fits",
      () => {
        const oversizedUser =
          "question ".repeat(
            1800,
          );

        const result =
          buildBrowserContext({
            systemPrompt:
              "You are Mabojolu.",

            messages: [
              message(
                "u1",
                "user",
                oversizedUser,
              ),

              message(
                "a1",
                "assistant",
                "A short answer that must not survive without its user turn.",
              ),

              message(
                "u2",
                "user",
                "Current request",
              ),
            ],

            maxOutputTokens:
              1024,
          });

        expect(
          result
            .messages
            .map(
              (entry) =>
                entry.content,
            ),
        ).toEqual([
          "You are Mabojolu.",
          "Current request",
        ]);
      },
    );

    it(
      "returns fits false rather than truncating an oversized current prompt",
      () => {
        const oversized =
          "current ".repeat(
            3000,
          );

        const result =
          buildBrowserContext({
            systemPrompt:
              "You are Mabojolu.",

            messages: [
              message(
                "u1",
                "user",
                oversized,
              ),
            ],

            maxOutputTokens:
              1024,
          });

        expect(
          result.fits,
        ).toBe(false);

        expect(
          result
            .messages
            .at(-1)
            ?.content,
        ).toBe(
          oversized,
        );
      },
    );

    it(
      "preserves recent conversational context when it fits",
      () => {
        const result =
          buildBrowserContext({
            systemPrompt:
              "You are Mabojolu.",

            messages: [
              message(
                "u1",
                "user",
                "My project is called Orion.",
              ),

              message(
                "a1",
                "assistant",
                "Understood.",
              ),

              message(
                "u2",
                "user",
                "What is my project called?",
              ),
            ],

            maxOutputTokens:
              1024,
          });

        expect(
          result
            .messages
            .map(
              (entry) =>
                entry.content,
            ),
        ).toEqual([
          "You are Mabojolu.",
          "My project is called Orion.",
          "Understood.",
          "What is my project called?",
        ]);
      },
    );
  },
);
