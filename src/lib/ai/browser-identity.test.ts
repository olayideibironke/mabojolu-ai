import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BROWSER_SYSTEM_PROMPT,
  mabojoluIdentityResponse,
} from "./browser-identity";

describe(
  "Mabojolu browser identity",
  () => {
    it(
      "identifies Westforge Holdings Inc. as Mabojolu's builder",
      () => {
        const response =
          mabojoluIdentityResponse([
            {
              role:
                "user",
              content:
                "Who created you?",
            },
          ]);

        expect(
          response,
        ).toContain(
          "Westforge Holdings Inc.",
        );

        expect(
          response,
        ).toContain(
          "Mabojolu",
        );
      },
    );

    it(
      "does not answer unrelated creator questions",
      () => {
        expect(
          mabojoluIdentityResponse([
            {
              role:
                "user",
              content:
                "Who created GitHub?",
            },
          ]),
        ).toBeNull();
      },
    );

    it(
      "describes base models as implementation details",
      () => {
        expect(
          mabojoluIdentityResponse([
            {
              role:
                "user",
              content:
                "What model are you?",
            },
          ]),
        ).toContain(
          "underlying local foundation model",
        );
      },
    );

    it(
      "tells browser models not to adopt a vendor identity",
      () => {
        expect(
          BROWSER_SYSTEM_PROMPT,
        ).toContain(
          "Never introduce yourself as Gemma",
        );

        expect(
          BROWSER_SYSTEM_PROMPT,
        ).toContain(
          "A Westforge Holdings Inc. Product",
        );

        expect(
          BROWSER_SYSTEM_PROMPT,
        ).not.toContain(
          "Mabojolu by Westforge",
        );
      },
    );
  },
);
