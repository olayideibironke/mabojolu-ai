import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  authRuntimeMode,
  persistenceRuntimeMode,
} from "./runtime-mode";

describe(
  "production runtime modes",
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it(
      "forces Supabase auth in production",
      () => {
        vi.stubEnv(
          "NODE_ENV",
          "production",
        );

        vi.stubEnv(
          "AUTH_MODE",
          "dev",
        );

        expect(
          authRuntimeMode(),
        ).toBe(
          "supabase",
        );
      },
    );

    it(
      "forces Supabase persistence in production",
      () => {
        vi.stubEnv(
          "NODE_ENV",
          "production",
        );

        vi.stubEnv(
          "PERSISTENCE",
          "local",
        );

        expect(
          persistenceRuntimeMode(),
        ).toBe(
          "supabase",
        );
      },
    );

    it(
      "keeps explicit Supabase modes in development",
      () => {
        vi.stubEnv(
          "NODE_ENV",
          "development",
        );

        vi.stubEnv(
          "AUTH_MODE",
          "supabase",
        );

        vi.stubEnv(
          "PERSISTENCE",
          "supabase",
        );

        expect(
          authRuntimeMode(),
        ).toBe(
          "supabase",
        );

        expect(
          persistenceRuntimeMode(),
        ).toBe(
          "supabase",
        );
      },
    );

    it(
      "defaults development to local modes",
      () => {
        vi.stubEnv(
          "NODE_ENV",
          "development",
        );

        vi.stubEnv(
          "AUTH_MODE",
          "",
        );

        vi.stubEnv(
          "PERSISTENCE",
          "",
        );

        expect(
          authRuntimeMode(),
        ).toBe(
          "dev",
        );

        expect(
          persistenceRuntimeMode(),
        ).toBe(
          "local",
        );
      },
    );
  },
);
