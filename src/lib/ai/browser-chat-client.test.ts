import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BROWSER_FAILURE_COOLDOWN_MS,
  BROWSER_FAILURE_STORAGE_KEY,
  shouldUseBrowserChat,
} from "./browser-chat-client";

const BASE_BODY = {
  messages: [
    {
      id:
        "user-1",

      role:
        "user" as const,

      content:
        "Hello Mabojolu",

      createdAt:
        "2026-09-19T19:00:00.000Z",
    },
  ],

  modelId:
    "mabojolu-fast",

  idempotencyKey:
    "request-1",
};

afterEach(
  () => {
    vi.unstubAllGlobals();
  },
);

function enableWebGpu():
  void {
  vi.stubGlobal(
    "Worker",
    class FakeWorker {},
  );

  Object.defineProperty(
    navigator,
    "gpu",
    {
      configurable:
        true,

      value: {},
    },
  );
}

describe(
  "Mabojolu browser chat routing",
  () => {
    it(
      "routes eligible Fast text chat to user-owned WebGPU compute",
      () => {
        enableWebGpu();

        expect(
          shouldUseBrowserChat(
            BASE_BODY,
          ),
        ).toBe(true);
      },
    );

    it(
      "keeps larger response modes on the configured server runtime",
      () => {
        enableWebGpu();

        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            modelId:
              "mabojolu-regular",
          }),
        ).toBe(false);

        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            modelId:
              "mabojolu-local",
          }),
        ).toBe(false);
      },
    );

    it(
      "keeps image requests off the text-only browser model",
      () => {
        enableWebGpu();

        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            messages: [
              {
                ...BASE_BODY
                  .messages[0],

                attachments: [
                  {
                    id:
                      "image-1",

                    name:
                      "image.png",

                    mimeType:
                      "image/png",

                    sizeBytes:
                      10,

                    dataUrl:
                      "data:image/png;base64,AAAA",
                  },
                ],
              },
            ],
          }),
        ).toBe(false);
      },
    );

    it(
      "falls back to Ollama when the current prompt cannot fit the browser context without truncation",
      () => {
        enableWebGpu();

        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            messages: [
              {
                ...BASE_BODY
                  .messages[0],

                content:
                  "oversized ".repeat(
                    4000,
                  ),
              },
            ],
          }),
        ).toBe(false);
      },
    );

    it(
      "temporarily falls back to Ollama after a browser-compute failure",
      () => {
        enableWebGpu();

        vi.stubGlobal(
          "window",
          {
            localStorage: {
              getItem:
                (
                  key:
                    string,
                ) =>
                  key ===
                    BROWSER_FAILURE_STORAGE_KEY
                    ? String(
                        Date.now() +
                          BROWSER_FAILURE_COOLDOWN_MS,
                      )
                    : null,

              removeItem:
                vi.fn(),

              setItem:
                vi.fn(),
            },
          },
        );

        expect(
          shouldUseBrowserChat(
            BASE_BODY,
          ),
        ).toBe(false);
      },
    );

    it(
      "falls back when WebGPU is unavailable",
      () => {
        vi.stubGlobal(
          "Worker",
          class FakeWorker {},
        );

        Object.defineProperty(
          navigator,
          "gpu",
          {
            configurable:
              true,

            value:
              undefined,
          },
        );

        expect(
          shouldUseBrowserChat(
            BASE_BODY,
          ),
        ).toBe(false);
      },
    );

    it(
      "falls back when browser workers are unavailable",
      () => {
        Object.defineProperty(
          navigator,
          "gpu",
          {
            configurable:
              true,

            value: {},
          },
        );

        vi.stubGlobal(
          "Worker",
          undefined,
        );

        expect(
          shouldUseBrowserChat(
            BASE_BODY,
          ),
        ).toBe(false);
      },
    );
  },
);
