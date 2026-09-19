import {
  describe,
  expect,
  it,
} from "vitest";

import {
  selectComputeRoute,
  type ComputeCandidate,
} from "./compute-router";

function candidate(
  input:
    Partial<
      ComputeCandidate
    > &
    Pick<
      ComputeCandidate,
      | "id"
      | "backend"
      | "owner"
    >,
):
  ComputeCandidate {
  return {
    available:
      true,

    supportsStreaming:
      true,

    requiresCredential:
      false,

    externalMeteredCost:
      false,

    ...input,
  };
}

describe(
  "Mabojolu compute independence routing",
  () => {
    it(
      "prefers user-owned browser compute over operator-hosted inference",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "ollama",
              backend:
                "local-ollama",
              owner:
                "operator",
            }),

            candidate({
              id:
                "browser",
              backend:
                "browser-webgpu",
              owner:
                "user",
            }),
          ]);

        expect(
          route
            ?.candidate
            .id,
        ).toBe(
          "browser",
        );
      },
    );

    it(
      "falls back to local Ollama when browser compute is unavailable",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "browser",
              backend:
                "browser-webgpu",
              owner:
                "user",
              available:
                false,
            }),

            candidate({
              id:
                "ollama",
              backend:
                "local-ollama",
              owner:
                "operator",
            }),
          ]);

        expect(
          route
            ?.candidate
            .id,
        ).toBe(
          "ollama",
        );
      },
    );

    it(
      "prefers self-hosted compute to paid external inference",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "paid",
              backend:
                "paid-external",
              owner:
                "external-provider",
              externalMeteredCost:
                true,
              requiresCredential:
                true,
            }),

            candidate({
              id:
                "self-hosted",
              backend:
                "self-hosted",
              owner:
                "operator",
            }),
          ], {
            allowPaidExternal:
              true,
          });

        expect(
          route
            ?.candidate
            .id,
        ).toBe(
          "self-hosted",
        );
      },
    );

    it(
      "refuses paid external inference by default even when it is the only available route",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "paid",
              backend:
                "paid-external",
              owner:
                "external-provider",
              externalMeteredCost:
                true,
              requiresCredential:
                true,
            }),
          ]);

        expect(
          route,
        ).toBeUndefined();
      },
    );

    it(
      "permits paid external inference only after explicit policy opt-in",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "paid",
              backend:
                "paid-external",
              owner:
                "external-provider",
              externalMeteredCost:
                true,
              requiresCredential:
                true,
            }),
          ], {
            allowPaidExternal:
              true,
          });

        expect(
          route
            ?.candidate
            .id,
        ).toBe(
          "paid",
        );
      },
    );

    it(
      "skips candidates that cannot satisfy a required streaming contract",
      () => {
        const route =
          selectComputeRoute([
            candidate({
              id:
                "browser-no-stream",
              backend:
                "browser-webgpu",
              owner:
                "user",
              supportsStreaming:
                false,
            }),

            candidate({
              id:
                "ollama",
              backend:
                "local-ollama",
              owner:
                "operator",
            }),
          ]);

        expect(
          route
            ?.candidate
            .id,
        ).toBe(
          "ollama",
        );
      },
    );
  },
);
