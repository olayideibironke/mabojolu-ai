import {
  describe,
  expect,
  it,
} from "vitest";

import {
  browserModelProgressLabel,
} from "./browser-progress";

describe(
  "browser model progress labels",
  () => {
    it(
      "shows a bounded percentage when progress is available",
      () => {
        expect(
          browserModelProgressLabel({
            progress:
              0.426,
          }),
        ).toBe(
          "Preparing on-device model... 43%",
        );

        expect(
          browserModelProgressLabel({
            progress:
              4,
          }),
        ).toBe(
          "Preparing on-device model... 100%",
        );
      },
    );

    it(
      "uses clean product copy when progress is unavailable",
      () => {
        expect(
          browserModelProgressLabel({
            text:
              "technical runtime detail",
          }),
        ).toBe(
          "Preparing on-device model...",
        );
      },
    );
  },
);
