import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizePluginReturnPath,
} from "./return-path";

describe(
  "plugin return path",
  () => {
    it(
      "keeps a Mabojolu chat path",
      () => {
        expect(
          normalizePluginReturnPath(
            "/?c=conversation-1",
          ),
        ).toBe(
          "/?c=conversation-1",
        );
      },
    );

    it(
      "rejects external and protocol-relative redirects",
      () => {
        expect(
          normalizePluginReturnPath(
            "https://example.com",
          ),
        ).toBe(
          "/",
        );

        expect(
          normalizePluginReturnPath(
            "//example.com",
          ),
        ).toBe(
          "/",
        );
      },
    );
  },
);
