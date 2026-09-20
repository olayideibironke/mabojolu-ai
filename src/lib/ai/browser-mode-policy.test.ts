import {
  describe,
  expect,
  it,
} from "vitest";

import {
  browserModePlan,
  resolveAvailableBrowserMode,
} from "./browser-mode-policy";

import {
  BROWSER_MODEL_FAST,
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
} from "./browser-device-profile";

import type {
  BrowserDeviceProfile,
} from "./browser-device-profile";

function profile(
  tier:
    BrowserDeviceProfile["tier"],
):
  BrowserDeviceProfile {
  return {
    tier,

    capabilities: {
      webGpu:
        tier !==
          "unavailable",

      webAssembly:
        true,

      eligible:
        tier !==
          "unavailable",

      reasons:
        [],
    },

    hardwareConcurrency:
      tier === "strong"
        ? 12
        : 4,

    deviceMemoryGb:
      tier === "strong"
        ? 16
        : 4,

    modelCandidates:
      tier === "unavailable"
        ? []
        : [
            "Llama-3.2-1B-Instruct-q4f16_1-MLC",
          ],

    maxOutputTokens:
      1024,

    reasons:
      [],
  };
}

describe(
  "browser response mode policy",
  () => {
    it(
      "uses the lightweight model for Fast even on compatible devices",
      () => {
        const plan =
          browserModePlan(
            "mabojolu-fast",
            profile(
              "constrained",
            ),
          );

        expect(
          plan.available,
        ).toBe(true);

        expect(
          plan.modelCandidates,
        ).toEqual([
          BROWSER_MODEL_FAST,
        ]);

        expect(
          plan.maxOutputTokens,
        ).toBe(512);
      },
    );

    it(
      "keeps Regular available on standard compatible devices",
      () => {
        expect(
          browserModePlan(
            "mabojolu-regular",
            profile(
              "standard",
            ),
          ).available,
        ).toBe(true);
      },
    );

    it(
      "requires a strong device for Quality",
      () => {
        expect(
          browserModePlan(
            "mabojolu-local",
            profile(
              "standard",
            ),
          ).available,
        ).toBe(false);

        expect(
          browserModePlan(
            "mabojolu-local",
            profile(
              "strong",
            ),
          ).available,
        ).toBe(true);
      },
    );

    it(
      "falls back from Quality to Regular on a standard device",
      () => {
        expect(
          resolveAvailableBrowserMode(
            "mabojolu-local",
            profile(
              "standard",
            ),
          ),
        ).toBe(
          "mabojolu-regular",
        );
      },
    );

    it(
      "keeps a supported preferred mode unchanged",
      () => {
        expect(
          resolveAvailableBrowserMode(
            "mabojolu-fast",
            profile(
              "standard",
            ),
          ),
        ).toBe(
          "mabojolu-fast",
        );
      },
    );

    it(
      "keeps Regular and Quality on larger models",
      () => {
        expect(
          browserModePlan(
            "mabojolu-regular",
            profile(
              "strong",
            ),
          ).modelCandidates,
        ).toEqual([
          BROWSER_MODEL_3B,
          BROWSER_MODEL_1B,
        ]);

        expect(
          browserModePlan(
            "mabojolu-local",
            profile(
              "strong",
            ),
          ).modelCandidates,
        ).toEqual([
          BROWSER_MODEL_3B,
        ]);
      },
    );

    it(
      "marks every mode unavailable without browser compute",
      () => {
        const unavailable =
          profile(
            "unavailable",
          );

        expect(
          browserModePlan(
            "mabojolu-fast",
            unavailable,
          ).available,
        ).toBe(false);

        expect(
          browserModePlan(
            "mabojolu-regular",
            unavailable,
          ).available,
        ).toBe(false);

        expect(
          browserModePlan(
            "mabojolu-local",
            unavailable,
          ).available,
        ).toBe(false);
      },
    );
  },
);
