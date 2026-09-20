import {
  describe,
  expect,
  it,
} from "vitest";

import {
  latestChromePrompt,
} from "./chrome-prompt-client";

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
  },
);
