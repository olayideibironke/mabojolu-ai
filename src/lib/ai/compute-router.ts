export type ComputeBackend =
  | "browser-webgpu"
  | "local-ollama"
  | "self-hosted"
  | "mock"
  | "paid-external";

export type ComputeOwner =
  | "user"
  | "operator"
  | "external-provider";

export interface ComputeCandidate {
  id: string;

  backend:
    ComputeBackend;

  owner:
    ComputeOwner;

  available: boolean;

  supportsStreaming:
    boolean;

  requiresCredential:
    boolean;

  /**
   * True when ordinary usage can create a provider bill tied to generated
   * tokens or equivalent metered inference.
   */
  externalMeteredCost:
    boolean;
}

export interface ComputeRoutingPolicy {
  allowPaidExternal?:
    boolean;

  requireStreaming?:
    boolean;
}

export interface ComputeRoute {
  candidate:
    ComputeCandidate;

  reason: string;
}

function rankCandidate(
  candidate:
    ComputeCandidate,
): number {
  switch (
    candidate.backend
  ) {
    case "browser-webgpu":
      return 0;

    case "local-ollama":
      return 10;

    case "self-hosted":
      return 20;

    case "mock":
      return 30;

    case "paid-external":
      return 100;
  }
}

/**
 * Mabojolu Compute Independence Router v0.1.
 *
 * The router prefers compute that does not create a metered external inference
 * bill:
 *
 * 1. user-owned browser/WebGPU compute
 * 2. operator-controlled local Ollama
 * 3. operator-controlled self-hosted inference
 * 4. deterministic mock compute
 * 5. paid external inference only after explicit opt-in
 *
 * The router does not silently fall through to a paid provider.
 */
export function selectComputeRoute(
  candidates:
    readonly ComputeCandidate[],

  policy:
    ComputeRoutingPolicy =
      {},
):
  ComputeRoute |
  undefined {
  const allowPaidExternal =
    policy.allowPaidExternal ??
    false;

  const requireStreaming =
    policy.requireStreaming ??
    true;

  const eligible =
    candidates
      .filter(
        (candidate) =>
          candidate.available,
      )
      .filter(
        (candidate) =>
          !requireStreaming ||
          candidate
            .supportsStreaming,
      )
      .filter(
        (candidate) =>
          allowPaidExternal ||
          !candidate
            .externalMeteredCost,
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rankDifference =
            rankCandidate(
              left,
            ) -
            rankCandidate(
              right,
            );

          if (
            rankDifference !==
            0
          ) {
            return rankDifference;
          }

          return left.id.localeCompare(
            right.id,
          );
        },
      );

  const candidate =
    eligible[0];

  if (
    !candidate
  ) {
    return undefined;
  }

  const reason =
    candidate.backend ===
      "browser-webgpu"
      ? "Use user-owned browser compute to avoid server inference cost."
      : candidate.backend ===
          "local-ollama"
        ? "Use operator-controlled local inference with no external per-token bill."
        : candidate.backend ===
            "self-hosted"
          ? "Use operator-controlled self-hosted inference before any paid external fallback."
          : candidate.backend ===
              "mock"
            ? "Use deterministic local mock compute."
            : "Use explicitly authorized paid external inference.";

  return {
    candidate: {
      ...candidate,
    },

    reason,
  };
}
