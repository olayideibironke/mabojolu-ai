import {
  detectBrowserComputeCapabilities,
  type BrowserComputeCapabilities,
} from "./browser-compute";

export type BrowserDeviceTier =
  | "unavailable"
  | "constrained"
  | "standard"
  | "strong";

export interface BrowserDeviceProfile {
  tier:
    BrowserDeviceTier;

  capabilities:
    BrowserComputeCapabilities;

  hardwareConcurrency:
    number;

  deviceMemoryGb:
    number |
    null;

  modelCandidates:
    string[];

  maxOutputTokens:
    number;

  reasons:
    string[];
}

export interface BrowserDeviceProbe {
  webGpu?:
    boolean;

  webAssembly?:
    boolean;

  hardwareConcurrency?:
    number;

  deviceMemoryGb?:
    number |
    null;

  workerAvailable?:
    boolean;
}

export const BROWSER_MODEL_1B =
  "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export const BROWSER_MODEL_3B =
  "Llama-3.2-3B-Instruct-q4f16_1-MLC";

function readNumber(
  value:
    unknown,
):
  number |
  null {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    ) &&
    value >
      0
      ? value
      : null
  );
}

/**
 * Conservative browser-device assessment for Mabojolu-owned routing.
 *
 * deviceMemory is a coarse browser hint, not a direct measurement of GPU VRAM.
 * It is therefore used only to decide whether the larger model is worth trying.
 * The WebLLM worker still falls back to the 1B model if allocation fails.
 */
export function profileBrowserDevice(
  probe:
    BrowserDeviceProbe =
      {},
):
  BrowserDeviceProfile {
  const capabilities =
    detectBrowserComputeCapabilities({
      ...(probe.webGpu ===
        undefined
        ? {}
        : {
            webGpu:
              probe.webGpu,
          }),

      ...(probe.webAssembly ===
        undefined
        ? {}
        : {
            webAssembly:
              probe.webAssembly,
          }),
    });

  const workerAvailable =
    probe.workerAvailable ??
    (
      typeof Worker !==
      "undefined"
    );

  const hardwareConcurrency =
    probe.hardwareConcurrency ??
    (
      typeof navigator !==
        "undefined"
        ? readNumber(
            navigator
              .hardwareConcurrency,
          ) ??
          1
        : 1
    );

  const detectedMemory =
    probe.deviceMemoryGb !==
      undefined
      ? probe.deviceMemoryGb
      : typeof navigator !==
          "undefined"
        ? readNumber(
            Reflect.get(
              navigator,
              "deviceMemory",
            ),
          )
        : null;

  const reasons = [
    ...capabilities
      .reasons,
  ];

  if (
    !workerAvailable
  ) {
    reasons.push(
      "Web workers are unavailable.",
    );
  }

  if (
    !capabilities.eligible ||
    !workerAvailable
  ) {
    return {
      tier:
        "unavailable",

      capabilities,

      hardwareConcurrency,

      deviceMemoryGb:
        detectedMemory,

      modelCandidates:
        [],

      maxOutputTokens:
        0,

      reasons,
    };
  }

  if (
    (
      detectedMemory !==
        null &&
      detectedMemory <
        4
    ) ||
    hardwareConcurrency <
      4
  ) {
    return {
      tier:
        "constrained",

      capabilities,

      hardwareConcurrency,

      deviceMemoryGb:
        detectedMemory,

      modelCandidates: [
        BROWSER_MODEL_1B,
      ],

      maxOutputTokens:
        768,

      reasons: [
        ...reasons,

        "Device resources are limited, so Mabojolu will use the smallest browser model.",
      ],
    };
  }

  if (
    detectedMemory !==
      null &&
    detectedMemory >=
      8 &&
    hardwareConcurrency >=
      8
  ) {
    return {
      tier:
        "strong",

      capabilities,

      hardwareConcurrency,

      deviceMemoryGb:
        detectedMemory,

      modelCandidates: [
        BROWSER_MODEL_3B,
        BROWSER_MODEL_1B,
      ],

      maxOutputTokens:
        1536,

      reasons,
    };
  }

  return {
    tier:
      "standard",

    capabilities,

    hardwareConcurrency,

    deviceMemoryGb:
      detectedMemory,

    modelCandidates: [
      BROWSER_MODEL_1B,
    ],

    maxOutputTokens:
      1024,

    reasons,
  };
}
