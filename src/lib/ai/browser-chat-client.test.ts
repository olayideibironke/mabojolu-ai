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
      "keeps eligible Fast text chat on user-owned browser compute",
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
      "keeps Regular and Quality text modes on user-owned browser compute",
      () => {
        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            modelId:
              "mabojolu-regular",
          }),
        ).toBe(true);

        expect(
          shouldUseBrowserChat({
            ...BASE_BODY,

            modelId:
              "mabojolu-local",
          }),
        ).toBe(true);
      },
    );

    it(
      "keeps local-mode image requests inside the browser path for explicit rejection",
      () => {
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
        ).toBe(true);
      },
    );

    it(
      "does not silently route oversized Fast text to a server provider",
      () => {
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
        ).toBe(true);
      },
    );

    it(
      "does not silently route Fast text to a server provider when WebGPU is unavailable",
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
        ).toBe(true);
      },
    );

    it(
      "does not silently route Fast text to a server provider when browser workers are unavailable",
      () => {
        vi.stubGlobal(
          "Worker",
          undefined,
        );

        expect(
          shouldUseBrowserChat(
            BASE_BODY,
          ),
        ).toBe(true);
      },
    );

    it(
      "does not silently route Fast text to a server provider after a browser failure cooldown",
      () => {
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
        ).toBe(true);
      },
    );
  },
);
