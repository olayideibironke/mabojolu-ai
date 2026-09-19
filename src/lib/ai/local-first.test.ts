import {
  describe,
  expect,
  it,
} from "vitest";

import {
  defaultModelFor,
  estimateCostUsd,
  modelsForProvider,
} from "./models";

describe(
  "Mabojolu local-first inference policy",
  () => {
    it(
      "uses a local Ollama model as the default real inference model",
      () => {
        const model =
          defaultModelFor(
            "ollama",
          );

        expect(
          model.providerId,
        ).toBe(
          "ollama",
        );

        expect(
          model.id,
        ).toBe(
          "mabojolu-fast",
        );
      },
    );

    it(
      "assigns zero external per-token cost to every local model",
      () => {
        const models =
          modelsForProvider(
            "ollama",
          );

        expect(
          models.length,
        ).toBeGreaterThan(0);

        for (
          const model of models
        ) {
          expect(
            model.pricing,
          ).toEqual({
            inputPerMillionUsd:
              0,

            outputPerMillionUsd:
              0,
          });

          expect(
            estimateCostUsd(
              model,
              {
                inputTokens:
                  1_000_000,

                outputTokens:
                  1_000_000,
              },
            ),
          ).toBe(0);
        }
      },
    );
  },
);
