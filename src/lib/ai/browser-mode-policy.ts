import {
  BROWSER_MODEL_1B,
  BROWSER_MODEL_3B,
  type BrowserDeviceProfile,
} from "./browser-device-profile";

export type BrowserOwnedModelId =
  | "mabojolu-fast"
  | "mabojolu-regular"
  | "mabojolu-local";

export interface BrowserModePlan {
  displayModel:
    string;

  modelCandidates:
    string[];

  maxOutputTokens:
    number;

  available:
    boolean;

  unavailableReason?:
    string;
}

export function isBrowserOwnedModel(
  value:
    string |
    undefined,
):
  value is
    BrowserOwnedModelId {
  return (
    value ===
      "mabojolu-fast" ||
    value ===
      "mabojolu-regular" ||
    value ===
      "mabojolu-local"
  );
}

export function browserModePlan(
  modelId:
    BrowserOwnedModelId,

  profile:
    BrowserDeviceProfile,
):
  BrowserModePlan {
  const suffix =
    modelId ===
      "mabojolu-local"
      ? "quality"
      : modelId.replace(
          "mabojolu-",
          "",
        );

  if (
    profile.tier ===
      "unavailable"
  ) {
    return {
      displayModel:
        "mabojolu-browser-" +
        suffix,

      modelCandidates:
        [],

      maxOutputTokens:
        0,

      available:
        false,

      unavailableReason:
        "This device cannot run Mabojolu on-device because WebGPU or browser workers are unavailable.",
    };
  }

  if (
    modelId ===
      "mabojolu-fast"
  ) {
    return {
      displayModel:
        "mabojolu-browser-fast",

      modelCandidates:
        [
          ...profile
            .modelCandidates,
        ],

      maxOutputTokens:
        profile
          .maxOutputTokens,

      available:
        true,
    };
  }

  if (
    modelId ===
      "mabojolu-regular"
  ) {
    return {
      displayModel:
        "mabojolu-browser-regular",

      modelCandidates:
        profile.tier ===
          "strong"
          ? [
              BROWSER_MODEL_3B,
              BROWSER_MODEL_1B,
            ]
          : [
              BROWSER_MODEL_1B,
            ],

      maxOutputTokens:
        profile.tier ===
          "constrained"
          ? 768
          : profile.tier ===
              "strong"
            ? 1536
            : 1024,

      available:
        true,
    };
  }

  if (
    profile.tier !==
      "strong"
  ) {
    return {
      displayModel:
        "mabojolu-browser-quality",

      modelCandidates:
        [],

      maxOutputTokens:
        0,

      available:
        false,

      unavailableReason:
        "Quality needs a stronger WebGPU-capable device. Fast or Regular is available on this device.",
    };
  }

  return {
    displayModel:
      "mabojolu-browser-quality",

    modelCandidates: [
      BROWSER_MODEL_3B,
    ],

    maxOutputTokens:
      1536,

    available:
      true,
  };
}


export function resolveAvailableBrowserMode(
  preferred:
    BrowserOwnedModelId,

  profile:
    BrowserDeviceProfile,
):
  BrowserOwnedModelId {
  if (
    browserModePlan(
      preferred,
      profile,
    ).available
  ) {
    return preferred;
  }

  const fallbackOrder:
    BrowserOwnedModelId[] = [
      "mabojolu-regular",
      "mabojolu-fast",
    ];

  for (
    const candidate of
      fallbackOrder
  ) {
    if (
      browserModePlan(
        candidate,
        profile,
      ).available
    ) {
      return candidate;
    }
  }

  return preferred;
}
