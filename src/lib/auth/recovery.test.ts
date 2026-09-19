import {
  describe,
  expect,
  it,
} from "vitest";

import {
  hasRecentRecoveryRequest,
  resolveAuthCallbackTarget,
  safeAuthNext,
} from "./recovery";

describe(
  "Mabojolu auth recovery routing",
  () => {
    it(
      "routes a recent recovery fallback to the reset-password page",
      () => {
        const now =
          Date.parse(
            "2026-09-19T22:00:00.000Z",
          );

        expect(
          resolveAuthCallbackTarget({
            requestedNext:
              null,
            recoverySentAt:
              "2026-09-19T21:45:25.000Z",
            now,
          }),
        ).toBe(
          "/reset-password",
        );
      },
    );

    it(
      "does not treat an old recovery request as the current auth flow",
      () => {
        const now =
          Date.parse(
            "2026-09-19T22:00:00.000Z",
          );

        expect(
          hasRecentRecoveryRequest(
            "2026-09-18T20:00:00.000Z",
            now,
          ),
        ).toBe(
          false,
        );

        expect(
          resolveAuthCallbackTarget({
            requestedNext:
              null,
            recoverySentAt:
              "2026-09-18T20:00:00.000Z",
            now,
          }),
        ).toBe(
          "/",
        );
      },
    );

    it(
      "honors an explicit local callback target",
      () => {
        expect(
          resolveAuthCallbackTarget({
            requestedNext:
              "/reset-password",
            recoverySentAt:
              null,
          }),
        ).toBe(
          "/reset-password",
        );
      },
    );

    it(
      "rejects external and protocol-relative callback targets",
      () => {
        expect(
          safeAuthNext(
            "https://attacker.example",
          ),
        ).toBeNull();

        expect(
          safeAuthNext(
            "//attacker.example",
          ),
        ).toBeNull();

        expect(
          resolveAuthCallbackTarget({
            requestedNext:
              "https://attacker.example",
            recoverySentAt:
              null,
          }),
        ).toBe(
          "/",
        );
      },
    );
  },
);
