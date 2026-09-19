import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
  profileBrowserDevice,
} from "./browser-device-profile";

describe(
  "Mabojolu adaptive browser device profiling",
  () => {
    it(
      "rejects browser inference when WebGPU is unavailable",
      () => {
        const profile =
          profileBrowserDevice({
            webGpu:
              false,

            webAssembly:
              true,

            workerAvailable:
              true,

            hardwareConcurrency:
              8,

            deviceMemoryGb:
              16,
          });

        expect(
          profile.tier,
        ).toBe(
          "unavailable",
        );

        expect(
          profile.modelCandidates,
        ).toEqual([]);
      },
    );

    it(
      "uses the smallest browser model on constrained devices",
      () => {
        const profile =
          profileBrowserDevice({
            webGpu:
              true,

            webAssembly:
              true,

            workerAvailable:
              true,

            hardwareConcurrency:
              2,

            deviceMemoryGb:
              4,
          });

        expect(
          profile.tier,
        ).toBe(
          "constrained",
        );

        expect(
          profile.modelCandidates,
        ).toEqual([
          BROWSER_MODEL_1B,
        ]);

        expect(
          profile.maxOutputTokens,
        ).toBe(768);
      },
    );

    it(
      "uses the 1B model on ordinary compatible devices",
      () => {
        const profile =
          profileBrowserDevice({
            webGpu:
              true,

            webAssembly:
              true,

            workerAvailable:
              true,

            hardwareConcurrency:
              6,

            deviceMemoryGb:
              6,
          });

        expect(
          profile.tier,
        ).toBe(
          "standard",
        );

        expect(
          profile.modelCandidates,
        ).toEqual([
          BROWSER_MODEL_1B,
        ]);

        expect(
          profile.maxOutputTokens,
        ).toBe(1024);
      },
    );

    it(
      "tries the 3B model first on strong devices and keeps 1B as a fallback",
      () => {
        const profile =
          profileBrowserDevice({
            webGpu:
              true,

            webAssembly:
              true,

            workerAvailable:
              true,

            hardwareConcurrency:
              12,

            deviceMemoryGb:
              16,
          });

        expect(
          profile.tier,
        ).toBe(
          "strong",
        );

        expect(
          profile.modelCandidates,
        ).toEqual([
          BROWSER_MODEL_3B,
          BROWSER_MODEL_1B,
        ]);

        expect(
          profile.maxOutputTokens,
        ).toBe(1536);
      },
    );

    it(
      "does not assume a larger model is safe when the browser exposes no memory hint",
      () => {
        const profile =
          profileBrowserDevice({
            webGpu:
              true,

            webAssembly:
              true,

            workerAvailable:
              true,

            hardwareConcurrency:
              16,

            deviceMemoryGb:
              null,
          });

        expect(
          profile.tier,
        ).toBe(
          "standard",
        );

        expect(
          profile.modelCandidates,
        ).toEqual([
          BROWSER_MODEL_1B,
        ]);
      },
    );
  },
);
